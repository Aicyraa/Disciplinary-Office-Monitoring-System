import { checkTerm, nextClearanceStatus, termLabel } from '../domain/clearance/rules.js';
import type { ClearanceItemRecord, ClearanceRecord, ClearanceStore, ClearanceTx } from '../repositories/clearance/types.js';

export type ClearanceFailureCode =
  | 'not_found'
  | 'student_not_found'
  | 'invalid_input'
  | 'invalid_status'
  | 'clearance_exists'
  | 'requirement_exists'
  | 'server_not_configured';

export interface ClearanceFailure {
  ok: false;
  code: ClearanceFailureCode;
  message: string;
}

export type ClearanceResult<T> = ({ ok: true } & T) | ClearanceFailure;

export const MAX_TEXT_LENGTH = 1000;
export const MAX_LABEL_LENGTH = 200;

const fail = (code: ClearanceFailureCode, message: string): ClearanceFailure => ({ ok: false, code, message });

/** Trimmed text, `null` when empty or absent, `undefined` when it is not text or longer than the limit. */
function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text === '') return null;
  return text.length <= max ? text : undefined;
}

function requiredText(value: unknown, max: number): string | undefined {
  const text = optionalText(value, max);
  return text === null ? undefined : text;
}

/** True for a unique-constraint violation (Postgres 23505, Prisma P2002), so a lost race reads as "exists". */
export function isUniqueViolation(error: unknown): boolean {
  const text = [
    error instanceof Error ? error.message : '',
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '',
    typeof error === 'object' && error !== null && 'cause' in error ? JSON.stringify((error as { cause: unknown }).cause) : '',
  ].join(' ');
  return /unique constraint|duplicate key|\b23505\b|\bP2002\b/i.test(text);
}

export interface ClearanceService {
  /** The "set up the 4 standard requirements" button: one clearance for a student and term, default checklist. */
  setUp(input: {
    employeeId: string;
    studentId: string;
    academicYear: unknown;
    semester: unknown;
  }): Promise<ClearanceResult<{ clearanceId: number }>>;
  /**
   * The automatic term set-up (Power Automate, first day of a term): the standard checklist for every active
   * student who has no clearance for the term yet. Safe to run again: existing clearances are skipped. Each new
   * clearance's student is notified, and staff get one summary when the run created any.
   */
  setUpTerm(input: {
    employeeId: string;
    academicYear: unknown;
    semester: unknown;
  }): Promise<ClearanceResult<{ activeStudents: number; created: number; skipped: number }>>;
  markDone(input: {
    employeeId: string;
    clearanceId: number;
    requirementId: number;
    remarks: unknown;
  }): Promise<ClearanceResult<{ cleared: boolean }>>;
  /** Reopens a done item. The reason is required and is shown to the student. */
  reverse(input: {
    employeeId: string;
    clearanceId: number;
    requirementId: number;
    reason: unknown;
  }): Promise<ClearanceResult<unknown>>;
  addRequirement(input: { employeeId: string; clearanceId: number; label: unknown }): Promise<ClearanceResult<{ requirementId: number }>>;
  removeRequirement(input: {
    employeeId: string;
    clearanceId: number;
    requirementId: number;
  }): Promise<ClearanceResult<{ cleared: boolean }>>;
}

export function createClearanceService({
  store,
  now = () => new Date(),
}: {
  store: ClearanceStore;
  now?: () => Date;
}): ClearanceService {
  /** Locks the student, then reads the clearance, so status checks cannot be stale. */
  async function loadLocked(tx: ClearanceTx, clearanceId: number): Promise<ClearanceRecord | null> {
    const first = await tx.getClearance(clearanceId);
    if (!first) return null;
    await tx.lockStudent(first.studentId);
    return tx.getClearance(clearanceId);
  }

  const findItem = (record: ClearanceRecord, requirementId: number): ClearanceItemRecord | undefined =>
    record.items.find((entry) => entry.requirementId === requirementId);

  async function guarded<T>(work: () => Promise<ClearanceResult<T>>, onUnique: ClearanceFailure): Promise<ClearanceResult<T>> {
    try {
      return await work();
    } catch (error) {
      if (isUniqueViolation(error)) return onUnique;
      throw error;
    }
  }

  return {
    async setUp({ employeeId, studentId, academicYear, semester }) {
      if (!checkTerm(academicYear, semester)) {
        return fail('invalid_input', 'The school year must be four digits (for example 2026) and the semester 1 to 3.');
      }
      const year = academicYear as number;
      const term = semester as number;
      const exists = fail('clearance_exists', `A clearance for ${termLabel(year, term)} was already set up for this student.`);

      return guarded(
        () =>
          store.transaction(async (tx) => {
            if (!(await tx.studentExists(studentId))) return fail('student_not_found', 'No student has that ID.');
            await tx.lockStudent(studentId);
            if (await tx.findClearance(studentId, year, term)) return exists;

            const defaults = await tx.listDefaultRequirements();
            if (defaults.length === 0) {
              return fail('invalid_status', 'There are no standard requirements to set up. Ask the administrator to check the seed data.');
            }
            const at = now();
            const clearanceId = await tx.insertClearance({ studentId, employeeId, academicYear: year, semester: term });
            await tx.addItems(
              clearanceId,
              defaults.map((entry) => entry.requirementId),
            );
            await tx.addHistory({
              clearanceId,
              requirementId: null,
              eventType: 'set_up',
              remarks: `Standard requirements set up for ${termLabel(year, term)}.`,
              employeeId,
              date: at,
            });
            return { ok: true as const, clearanceId };
          }),
        exists,
      );
    },

    async setUpTerm({ employeeId, academicYear, semester }) {
      if (!checkTerm(academicYear, semester)) {
        return fail('invalid_input', 'The school year must be four digits (for example 2026) and the semester 1 to 3.');
      }
      const year = academicYear as number;
      const term = semester as number;
      return store.transaction(async (tx) => {
        if (!(await tx.employeeExists(employeeId))) {
          return fail('server_not_configured', `The ${employeeId} employee account is missing. Add it from db/seed.sql before running the term set-up.`);
        }
        const defaults = await tx.listDefaultRequirements();
        if (defaults.length === 0) {
          return fail('invalid_status', 'There are no standard requirements to set up. Ask the administrator to check the seed data.');
        }
        const label = termLabel(year, term);
        const at = now();
        const { activeStudents, created } = await tx.setUpTermForActiveStudents({
          academicYear: year,
          semester: term,
          employeeId,
          remarks: `Standard requirements set up automatically for ${label}.`,
          date: at,
          notice: {
            title: `Clearance checklist ready for ${label}`,
            message:
              `Your clearance for ${label} was set up with the standard requirements: ${defaults.map((entry) => entry.label).join(', ')}. ` +
              'The SDO office marks each one done; you can follow your progress on the Clearance page.',
          },
        });
        const skipped = activeStudents - created;
        // Staff hear about a run that changed something; a retry that created nothing stays quiet.
        if (created > 0) {
          await tx.addStaffNotification({
            title: `Clearance set up for ${label}`,
            message: `The automatic term set-up gave ${created} of ${activeStudents} active students a clearance for ${label}. ${skipped} already had one.`,
            idempotencyKey: `clr:term:${year}-${term}:set_up:${at.getTime()}`,
          });
        }
        return { ok: true as const, activeStudents, created, skipped };
      });
    },

    async markDone({ employeeId, clearanceId, requirementId, remarks }) {
      const note = optionalText(remarks, MAX_TEXT_LENGTH);
      if (note === undefined) return fail('invalid_input', `Remarks must be text up to ${MAX_TEXT_LENGTH} characters.`);
      return store.transaction(async (tx) => {
        const record = await loadLocked(tx, clearanceId);
        if (!record) return fail('not_found', 'Clearance not found.');
        const entry = findItem(record, requirementId);
        if (!entry) return fail('not_found', 'That requirement is not on this clearance.');
        if (entry.status === 'completed') return fail('invalid_status', 'That requirement is already marked done.');

        const at = now();
        await tx.setItem(clearanceId, requirementId, {
          status: 'completed',
          remarks: note,
          completedByEmployeeId: employeeId,
          dateCompleted: at,
        });
        await tx.addHistory({ clearanceId, requirementId, eventType: 'marked_done', remarks: note, employeeId, date: at });

        const after = record.items.map((current) =>
          current.requirementId === requirementId ? { ...current, status: 'completed' as const } : current,
        );
        const becomesCleared = record.status !== 'cleared' && nextClearanceStatus(after) === 'cleared';
        const term = termLabel(record.academicYear, record.semester);
        if (becomesCleared) {
          await tx.setClearanceStatus(clearanceId, 'cleared');
          await tx.addNotification({
            studentId: record.studentId,
            title: `Clearance cleared for ${term}`,
            message: `Your clearance for ${term} is complete. "${entry.label}" was the last requirement marked done.`,
            clearanceId,
            idempotencyKey: `clr:${clearanceId}:cleared:${at.getTime()}`,
          });
        } else {
          await tx.addNotification({
            studentId: record.studentId,
            title: `Clearance requirement done: ${entry.label}`,
            message: `The SDO office marked "${entry.label}" as done for your ${term} clearance.${note ? ` Note: ${note}` : ''}`,
            clearanceId,
            idempotencyKey: `clr:${clearanceId}:${requirementId}:done:${at.getTime()}`,
          });
        }
        return { ok: true as const, cleared: becomesCleared };
      });
    },

    async reverse({ employeeId, clearanceId, requirementId, reason }) {
      const text = requiredText(reason, MAX_TEXT_LENGTH);
      if (text === undefined) return fail('invalid_input', `A reason is required (up to ${MAX_TEXT_LENGTH} characters).`);
      return store.transaction(async (tx) => {
        const record = await loadLocked(tx, clearanceId);
        if (!record) return fail('not_found', 'Clearance not found.');
        const entry = findItem(record, requirementId);
        if (!entry) return fail('not_found', 'That requirement is not on this clearance.');
        if (entry.status !== 'completed') return fail('invalid_status', 'Only a requirement that is marked done can be reversed.');

        const at = now();
        await tx.setItem(clearanceId, requirementId, {
          status: 'pending',
          remarks: null,
          completedByEmployeeId: null,
          dateCompleted: null,
        });
        const wasCleared = record.status === 'cleared';
        if (wasCleared) await tx.setClearanceStatus(clearanceId, 'pending');
        await tx.addHistory({ clearanceId, requirementId, eventType: 'reversed', remarks: text, employeeId, date: at });
        const term = termLabel(record.academicYear, record.semester);
        await tx.addNotification({
          studentId: record.studentId,
          title: `Clearance requirement reopened: ${entry.label}`,
          message: `The SDO office reopened "${entry.label}" for your ${term} clearance${
            wasCleared ? '; your clearance is pending again' : ''
          }. Reason: ${text}`,
          clearanceId,
          idempotencyKey: `clr:${clearanceId}:${requirementId}:reversed:${at.getTime()}`,
        });
        return { ok: true as const };
      });
    },

    async addRequirement({ employeeId, clearanceId, label }) {
      const text = requiredText(label, MAX_LABEL_LENGTH);
      if (text === undefined) return fail('invalid_input', `A label is required (up to ${MAX_LABEL_LENGTH} characters).`);
      const exists = fail('requirement_exists', 'That requirement is already on this clearance.');
      return guarded(
        () =>
          store.transaction(async (tx) => {
            const record = await loadLocked(tx, clearanceId);
            if (!record) return fail('not_found', 'Clearance not found.');
            if (record.items.some((entry) => entry.label.toLowerCase() === text.toLowerCase())) return exists;

            const requirement = (await tx.findRequirementByLabel(text)) ?? (await tx.insertRequirement(text));
            if (findItem(record, requirement.requirementId)) return exists;

            const at = now();
            await tx.addItems(clearanceId, [requirement.requirementId]);
            await tx.addHistory({
              clearanceId,
              requirementId: requirement.requirementId,
              eventType: 'requirement_added',
              remarks: requirement.label,
              employeeId,
              date: at,
            });
            // A new pending item reopens a cleared clearance.
            if (record.status === 'cleared') await tx.setClearanceStatus(clearanceId, 'pending');
            return { ok: true as const, requirementId: requirement.requirementId };
          }),
        exists,
      );
    },

    async removeRequirement({ employeeId, clearanceId, requirementId }) {
      return store.transaction(async (tx) => {
        const record = await loadLocked(tx, clearanceId);
        if (!record) return fail('not_found', 'Clearance not found.');
        const entry = findItem(record, requirementId);
        if (!entry) return fail('not_found', 'That requirement is not on this clearance.');
        if (record.items.length <= 1) {
          return fail('invalid_status', 'A clearance needs at least one requirement. Add another before removing this one.');
        }

        const at = now();
        await tx.removeItem(clearanceId, requirementId);
        await tx.addHistory({
          clearanceId,
          requirementId,
          eventType: 'requirement_removed',
          remarks: entry.label,
          employeeId,
          date: at,
        });

        const remaining = record.items.filter((current) => current.requirementId !== requirementId);
        const next = nextClearanceStatus(remaining);
        const becomesCleared = record.status !== 'cleared' && next === 'cleared';
        if (next !== record.status) await tx.setClearanceStatus(clearanceId, next);
        if (becomesCleared) {
          const term = termLabel(record.academicYear, record.semester);
          await tx.addNotification({
            studentId: record.studentId,
            title: `Clearance cleared for ${term}`,
            message: `Your clearance for ${term} is complete. Every remaining requirement is done.`,
            clearanceId,
            idempotencyKey: `clr:${clearanceId}:cleared:${at.getTime()}`,
          });
        }
        return { ok: true as const, cleared: becomesCleared };
      });
    },
  };
}
