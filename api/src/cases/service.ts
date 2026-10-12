import { planEscalations, type EscalationGroup } from './escalation.js';
import type { CaseRecord, CaseStore, CaseTx } from './types.js';

export type CaseFailureCode =
  | 'not_found'
  | 'student_not_found'
  | 'violation_not_found'
  | 'violation_not_allowed'
  | 'already_decided'
  | 'student_not_matched'
  | 'student_already_linked'
  | 'invalid_status'
  | 'sanctions_incomplete'
  | 'invalid_input';

export interface CaseFailure {
  ok: false;
  code: CaseFailureCode;
  message: string;
}

export type CaseResult<T> = ({ ok: true } & T) | CaseFailure;

export interface EscalationOutcome {
  conversions: EscalationGroup[];
}

export const MAX_TEXT_LENGTH = 1000;

const fail = (code: CaseFailureCode, message: string): CaseFailure => ({ ok: false, code, message });

/** Trimmed text, or null when it is empty or longer than the limit. */
function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= MAX_TEXT_LENGTH ? text : null;
}

const distinct = <T>(values: T[]): T[] => [...new Set(values)];

export interface CaseService {
  recordViolation(input: {
    employeeId: string;
    studentId: string;
    handbookEntryId: number;
    /** Optional note recorded with the violation; it becomes the first entry of the remarks log. */
    remarks?: unknown;
  }): Promise<CaseResult<{ caseId: number } & EscalationOutcome>>;
  previewEscalation(submissionRef: string): Promise<CaseResult<EscalationOutcome>>;
  validateSubmission(input: { employeeId: string; submissionRef: string }): Promise<CaseResult<{ caseIds: number[] } & EscalationOutcome>>;
  rejectSubmission(input: { employeeId: string; submissionRef: string; reason: unknown }): Promise<CaseResult<{ caseIds: number[] }>>;
  linkStudent(input: { employeeId: string; caseId: number; studentId: string }): Promise<CaseResult<{ caseIds: number[] }>>;
  resolveCase(input: { employeeId: string; caseId: number }): Promise<CaseResult<unknown>>;
  resolveWithoutSanction(input: { employeeId: string; caseId: number; reason: unknown }): Promise<CaseResult<unknown>>;
  addRemark(input: { employeeId: string; caseId: number; remarks: unknown }): Promise<CaseResult<unknown>>;
}

export function createCaseService({ store, now = () => new Date() }: { store: CaseStore; now?: () => Date }): CaseService {
  /**
   * Applies SPEC 4.2 for one student inside the caller's transaction: converts the 3rd minor of each group of
   * three into H068, flags the first two, links them, writes the timeline and notifies the student.
   */
  async function applyEscalation(tx: CaseTx, studentId: string, at: Date): Promise<EscalationGroup[]> {
    const cases = await tx.listStudentCases(studentId);
    const groups = planEscalations(cases);
    if (groups.length === 0) return [];

    const system = await tx.getSystemHandbookEntry();
    if (!system) throw new Error('The system handbook entry (H068 "3 minor offense") is missing from the database');

    for (const group of groups) {
      const major = cases.find((c) => c.caseId === group.majorCaseId) as CaseRecord;
      await tx.updateCase(major.caseId, {
        handbookEntryId: system.handbookEntryId,
        originalHandbookEntryId: major.handbookEntryId,
      });
      for (const minorId of group.minorCaseIds) {
        await tx.updateCase(minorId, { isEscalated: true });
        await tx.insertEscalation(major.caseId, minorId);
      }
      const linked = (await Promise.all(group.minorCaseIds.map((id) => tx.caseCode(id)))).join(' and ');
      const majorCode = await tx.caseCode(major.caseId);

      await tx.addHistory({
        caseId: major.caseId,
        eventType: 'escalated',
        statusAfter: major.status,
        remarks: `Treated as Major: 3rd minor violation. Linked cases ${linked}.`,
        employeeId: null,
        date: at,
      });
      for (const minorId of group.minorCaseIds) {
        const minor = cases.find((c) => c.caseId === minorId) as CaseRecord;
        await tx.addHistory({
          caseId: minorId,
          eventType: 'flagged_escalated',
          statusAfter: minor.status,
          remarks: `Counted toward Major case ${majorCode}.`,
          employeeId: null,
          date: at,
        });
      }
      await tx.addNotification({
        studentId,
        kind: 'esc',
        title: 'Violation treated as a Major offense',
        message: `Your third minor violation (case ${majorCode}) is now treated as a Major offense. Linked cases: ${linked}.`,
        caseId: major.caseId,
        idempotencyKey: `esc:${major.caseId}`,
      });
    }
    return groups;
  }

  async function loadSubmission(
    tx: CaseTx,
    submissionRef: string,
  ): Promise<{ ok: true; cases: CaseRecord[] } | CaseFailure> {
    const cases = await tx.listSubmission(submissionRef);
    if (cases.length === 0) return fail('not_found', 'No report with that reference was found.');
    return { ok: true, cases };
  }

  /**
   * Locks first, then reads, so the status checks that follow cannot be stale: a decision that committed while
   * this transaction waited for the lock is visible. Locks are taken in one order (submission, then students
   * sorted by id) so two transactions cannot deadlock.
   */
  async function loadSubmissionLocked(
    tx: CaseTx,
    submissionRef: string,
  ): Promise<{ ok: true; cases: CaseRecord[] } | CaseFailure> {
    await tx.lockSubmission(submissionRef);
    const first = await tx.listSubmission(submissionRef);
    if (first.length === 0) return fail('not_found', 'No report with that reference was found.');
    const students = distinct(first.map((c) => c.studentId).filter((id): id is string => id !== null)).sort();
    for (const studentId of students) await tx.lockStudent(studentId);
    return { ok: true, cases: await tx.listSubmission(submissionRef) };
  }

  /** Single-case version of the same rule: lock the student (or the submission), then read the case. */
  async function loadCaseLocked(tx: CaseTx, caseId: number): Promise<CaseRecord | null> {
    const first = await tx.getCase(caseId);
    if (!first) return null;
    if (first.submissionRef !== null) await tx.lockSubmission(first.submissionRef);
    if (first.studentId !== null) await tx.lockStudent(first.studentId);
    return tx.getCase(caseId);
  }

  return {
    async recordViolation({ employeeId, studentId, handbookEntryId, remarks }) {
      const blank = remarks === undefined || remarks === null || (typeof remarks === 'string' && remarks.trim() === '');
      const note = blank ? null : cleanText(remarks);
      if (!blank && note === null) return fail('invalid_input', `Remarks must be text up to ${MAX_TEXT_LENGTH} characters.`);
      return store.transaction(async (tx) => {
        if (!(await tx.studentExists(studentId))) return fail('student_not_found', 'No student has that ID.');
        const entry = await tx.getHandbookEntry(handbookEntryId);
        if (!entry) return fail('violation_not_found', 'That violation is not in the handbook.');
        if (entry.isSystem) return fail('violation_not_allowed', 'That violation is assigned by the system only.');

        const at = now();
        await tx.lockStudent(studentId);
        // Staff-recorded cases skip `reported` and start validated (SPEC 4.1).
        const caseId = await tx.insertCase({
          studentId,
          handbookEntryId,
          source: 'staff',
          reportedByEmployeeId: employeeId,
          status: 'validated',
          caseDate: at,
        });
        await tx.addHistory({
          caseId,
          eventType: 'validated',
          statusAfter: 'validated',
          remarks: 'Recorded by staff.',
          employeeId,
          date: at,
        });
        if (note !== null) {
          await tx.addHistory({ caseId, eventType: 'remark', statusAfter: 'validated', remarks: note, employeeId, date: at });
        }
        await tx.addNotification({
          studentId,
          kind: 'newviol',
          title: 'New violation recorded',
          message: `A ${entry.severity} violation, "${entry.violationType}", was recorded (case ${await tx.caseCode(caseId)}).`,
          caseId,
          idempotencyKey: `case:${caseId}:recorded`,
        });
        const conversions = await applyEscalation(tx, studentId, at);
        return { ok: true as const, caseId, conversions };
      });
    },

    async previewEscalation(submissionRef) {
      return store.transaction(async (tx) => {
        const loaded = await loadSubmission(tx, submissionRef);
        if (!loaded.ok) return loaded;
        if (loaded.cases.some((c) => c.status !== 'reported')) {
          return fail('already_decided', 'This report was already validated or rejected.');
        }
        if (loaded.cases.some((c) => c.studentId === null)) {
          return fail('student_not_matched', 'Link this report to a student first.');
        }
        const submissionIds = new Set(loaded.cases.map((c) => c.caseId));
        const conversions: EscalationGroup[] = [];
        for (const studentId of distinct(loaded.cases.map((c) => c.studentId as string))) {
          const current = await tx.listStudentCases(studentId);
          const before = new Set(planEscalations(current).map((g) => g.majorCaseId));
          const after = planEscalations(
            current.map((c) => (submissionIds.has(c.caseId) ? { ...c, status: 'validated' as const } : c)),
          );
          conversions.push(...after.filter((g) => !before.has(g.majorCaseId)));
        }
        return { ok: true as const, conversions };
      });
    },

    async validateSubmission({ employeeId, submissionRef }) {
      return store.transaction(async (tx) => {
        const loaded = await loadSubmissionLocked(tx, submissionRef);
        if (!loaded.ok) return loaded;
        if (loaded.cases.some((c) => c.status !== 'reported')) {
          return fail('already_decided', 'This report was already validated or rejected.');
        }
        if (loaded.cases.some((c) => c.studentId === null)) {
          return fail('student_not_matched', 'Cannot validate: link this report to a student first, or reject it.');
        }

        const at = now();
        const studentIds = distinct(loaded.cases.map((c) => c.studentId as string));
        for (const studentId of studentIds) await tx.lockStudent(studentId);

        for (const record of loaded.cases) {
          await tx.updateCase(record.caseId, { status: 'validated' });
          await tx.addHistory({
            caseId: record.caseId,
            eventType: 'validated',
            statusAfter: 'validated',
            remarks: null,
            employeeId,
            date: at,
          });
          await tx.addNotification({
            studentId: record.studentId as string,
            kind: 'case',
            title: 'Violation report validated',
            message: `Case ${await tx.caseCode(record.caseId)} was validated by the SDO office.`,
            caseId: record.caseId,
            idempotencyKey: `case:${record.caseId}:validated`,
          });
        }

        const conversions: EscalationGroup[] = [];
        for (const studentId of studentIds) conversions.push(...(await applyEscalation(tx, studentId, at)));
        return { ok: true as const, caseIds: loaded.cases.map((c) => c.caseId), conversions };
      });
    },

    async rejectSubmission({ employeeId, submissionRef, reason }) {
      const text = cleanText(reason);
      if (text === null) return fail('invalid_input', `A reason is required (up to ${MAX_TEXT_LENGTH} characters).`);
      return store.transaction(async (tx) => {
        const loaded = await loadSubmissionLocked(tx, submissionRef);
        if (!loaded.ok) return loaded;
        if (loaded.cases.some((c) => c.status !== 'reported')) {
          return fail('already_decided', 'This report was already validated or rejected.');
        }
        const at = now();
        for (const record of loaded.cases) {
          await tx.updateCase(record.caseId, { status: 'rejected' });
          await tx.addHistory({
            caseId: record.caseId,
            eventType: 'rejected',
            statusAfter: 'rejected',
            remarks: text,
            employeeId,
            date: at,
          });
          if (record.studentId !== null) {
            await tx.addNotification({
              studentId: record.studentId,
              kind: 'case',
              title: 'Violation report not verified',
              message: `Case ${await tx.caseCode(record.caseId)} could not be verified. Reason: ${text}`,
              caseId: record.caseId,
              idempotencyKey: `case:${record.caseId}:rejected`,
            });
          }
        }
        return { ok: true as const, caseIds: loaded.cases.map((c) => c.caseId) };
      });
    },

    async linkStudent({ employeeId, caseId, studentId }) {
      return store.transaction(async (tx) => {
        const record = await loadCaseLocked(tx, caseId);
        if (!record) return fail('not_found', 'Case not found.');
        if (record.studentId !== null) return fail('student_already_linked', 'This case is already linked to a student.');
        if (record.status !== 'reported') return fail('invalid_status', 'Only a reported case can be linked to a student.');
        if (!(await tx.studentExists(studentId))) return fail('student_not_found', 'No student has that ID.');

        const group =
          record.submissionRef === null ? [record] : (await tx.listSubmission(record.submissionRef)).filter((c) => c.studentId === null);
        const at = now();
        for (const member of group) {
          await tx.updateCase(member.caseId, { studentId });
          await tx.addHistory({
            caseId: member.caseId,
            eventType: 'remark',
            statusAfter: member.status,
            remarks: `Student ID corrected to ${studentId}.`,
            employeeId,
            date: at,
          });
        }
        return { ok: true as const, caseIds: group.map((c) => c.caseId) };
      });
    },

    async resolveCase({ employeeId, caseId }) {
      return store.transaction(async (tx) => {
        const record = await loadCaseLocked(tx, caseId);
        if (!record) return fail('not_found', 'Case not found.');
        if (record.status !== 'for_sanction') return fail('invalid_status', 'Only a case with an assigned sanction can be resolved this way.');
        const counts = await tx.sanctionCounts(caseId);
        if (counts.total === 0 || counts.completed !== counts.total) {
          return fail('sanctions_incomplete', 'Every sanction must be completed before the case can be resolved.');
        }
        const at = now();
        await tx.updateCase(caseId, { status: 'resolved', dateResolved: at });
        await tx.addHistory({ caseId, eventType: 'resolved', statusAfter: 'resolved', remarks: null, employeeId, date: at });
        if (record.studentId !== null) {
          await tx.addNotification({
            studentId: record.studentId,
            kind: 'case',
            title: 'Case resolved',
            message: `Case ${await tx.caseCode(caseId)} is resolved.`,
            caseId,
            idempotencyKey: `case:${caseId}:resolved`,
          });
        }
        return { ok: true as const };
      });
    },

    async resolveWithoutSanction({ employeeId, caseId, reason }) {
      const text = cleanText(reason);
      if (text === null) return fail('invalid_input', `A reason is required (up to ${MAX_TEXT_LENGTH} characters).`);
      return store.transaction(async (tx) => {
        const record = await loadCaseLocked(tx, caseId);
        if (!record) return fail('not_found', 'Case not found.');
        if (record.status !== 'validated') {
          return fail('invalid_status', 'Only a validated case with no sanction can be resolved without one.');
        }
        const at = now();
        await tx.updateCase(caseId, { status: 'resolved', resolvedWithoutSanction: true, dateResolved: at });
        await tx.addHistory({ caseId, eventType: 'resolved', statusAfter: 'resolved', remarks: text, employeeId, date: at });
        if (record.studentId !== null) {
          await tx.addNotification({
            studentId: record.studentId,
            kind: 'case',
            title: 'Case resolved',
            message: `Case ${await tx.caseCode(caseId)} was resolved without a sanction. Reason: ${text}`,
            caseId,
            idempotencyKey: `case:${caseId}:resolved`,
          });
        }
        return { ok: true as const };
      });
    },

    async addRemark({ employeeId, caseId, remarks }) {
      const text = cleanText(remarks);
      if (text === null) return fail('invalid_input', `A remark is required (up to ${MAX_TEXT_LENGTH} characters).`);
      return store.transaction(async (tx) => {
        const record = await loadCaseLocked(tx, caseId);
        if (!record) return fail('not_found', 'Case not found.');
        const at = now();
        await tx.addHistory({ caseId, eventType: 'remark', statusAfter: record.status, remarks: text, employeeId, date: at });
        if (record.studentId !== null) {
          await tx.addNotification({
            studentId: record.studentId,
            kind: 'case',
            title: 'New remark on your case',
            message: `The SDO office added a remark to case ${await tx.caseCode(caseId)}: ${text}`,
            caseId,
            idempotencyKey: `case:${caseId}:remark:${at.getTime()}`,
          });
        }
        return { ok: true as const };
      });
    },
  };
}
