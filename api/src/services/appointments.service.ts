import { endDateFor, checkStartDate, windowsOverlap, type StartDateCheck } from '../domain/appointments/window.js';
import type { AppointmentRecord, AppointmentStore, AppointmentTx } from '../types/appointments.types.js';

export type AppointmentFailureCode =
  | 'not_found'
  | 'student_not_found'
  | 'invalid_input'
  | 'invalid_date'
  | 'invalid_status'
  | 'appointment_overlap';

export interface AppointmentFailure {
  ok: false;
  code: AppointmentFailureCode;
  message: string;
}

export type AppointmentResult<T> = ({ ok: true } & T) | AppointmentFailure;

export const MAX_TEXT_LENGTH = 1000;
const HOURS = 'Monday to Saturday, 7:00 AM to 5:00 PM';

const fail = (code: AppointmentFailureCode, message: string): AppointmentFailure => ({ ok: false, code, message });

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Tue, Oct 13, 2026" from a YYYY-MM-DD calendar day. */
function friendly(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return `${WEEKDAYS[parsed.getUTCDay()]}, ${MONTHS[parsed.getUTCMonth()]} ${parsed.getUTCDate()}, ${parsed.getUTCFullYear()}`;
}
const range = (a: { startDate: string; endDate: string }) => `${friendly(a.startDate)} to ${friendly(a.endDate)}`;

/** Trimmed text, or `undefined` when it is empty, not text, or longer than the limit. */
function required(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text.length > 0 && text.length <= MAX_TEXT_LENGTH ? text : undefined;
}

/** Trimmed text, `null` when empty or absent, `undefined` when it is invalid (not text, or too long). */
function optional(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (text === '') return null;
  return text.length <= MAX_TEXT_LENGTH ? text : undefined;
}

const DATE_PROBLEM: Record<Exclude<StartDateCheck, { ok: true }>['reason'], string> = {
  format: 'The start date must be a real date (YYYY-MM-DD).',
  past: 'The start date cannot be in the past.',
  too_far: 'The start date can be at most 60 days from today.',
  sunday: 'The start date cannot be a Sunday.',
};

/** True for the error Postgres raises when the exclusion constraint on `appointments` rejects a write. */
export function isExclusionViolation(error: unknown): boolean {
  const text = [
    error instanceof Error ? error.message : '',
    typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '',
    typeof error === 'object' && error !== null && 'cause' in error ? JSON.stringify((error as { cause: unknown }).cause) : '',
  ].join(' ');
  return /exclusion constraint|\b23P01\b/i.test(text);
}

export interface AppointmentService {
  create(input: {
    employeeId: string;
    studentId: string;
    startDate: unknown;
    purpose: unknown;
    notes: unknown;
    /** Asia/Manila calendar day, YYYY-MM-DD. */
    today: string;
  }): Promise<AppointmentResult<{ appointmentId: number }>>;
  /** Moves the start date (rescheduled) and/or changes the purpose and notes (remarks updated). */
  update(input: {
    employeeId: string;
    appointmentId: number;
    startDate?: unknown;
    purpose?: unknown;
    notes?: unknown;
    today: string;
  }): Promise<AppointmentResult<unknown>>;
  complete(input: { employeeId: string; appointmentId: number }): Promise<AppointmentResult<unknown>>;
  cancel(input: { employeeId: string; appointmentId: number; reason: unknown }): Promise<AppointmentResult<unknown>>;
}

const OVERLAP_FALLBACK = 'The student already has an appointment in that window.';

export function createAppointmentService({
  store,
  now = () => new Date(),
}: {
  store: AppointmentStore;
  now?: () => Date;
}): AppointmentService {
  const isLive = (record: AppointmentRecord) => record.status === 'scheduled' || record.status === 'rescheduled';

  /** The student's other live window that the candidate overlaps, if any. */
  async function findOverlap(
    tx: AppointmentTx,
    studentId: string,
    candidate: { startDate: string; endDate: string },
    ignoreId: number | null,
  ): Promise<AppointmentRecord | null> {
    const live = await tx.listLiveForStudent(studentId);
    return live.find((other) => other.appointmentId !== ignoreId && windowsOverlap(other, candidate)) ?? null;
  }

  const overlapFailure = (clash: AppointmentRecord | null): AppointmentFailure =>
    fail(
      'appointment_overlap',
      clash
        ? `The student already has an appointment from ${range(clash)}. Windows for one student cannot overlap.`
        : OVERLAP_FALLBACK,
    );

  /** Runs a transaction and turns the database's own overlap refusal (a lost race) into the same friendly failure. */
  async function guarded<T>(work: (tx: AppointmentTx) => Promise<AppointmentResult<T>>): Promise<AppointmentResult<T>> {
    try {
      return await store.transaction(work);
    } catch (error) {
      if (isExclusionViolation(error)) return overlapFailure(null);
      throw error;
    }
  }

  return {
    async create({ employeeId, studentId, startDate, purpose, notes, today }) {
      if (typeof startDate !== 'string') return fail('invalid_date', DATE_PROBLEM.format);
      const check = checkStartDate(startDate, today);
      if (!check.ok) return fail('invalid_date', DATE_PROBLEM[check.reason]);
      const purposeText = required(purpose);
      if (purposeText === undefined) {
        return fail('invalid_input', `A purpose is required (up to ${MAX_TEXT_LENGTH} characters).`);
      }
      const notesText = optional(notes);
      if (notesText === undefined) return fail('invalid_input', `Notes must be text up to ${MAX_TEXT_LENGTH} characters.`);

      return guarded(async (tx) => {
        if (!(await tx.studentExists(studentId))) return fail('student_not_found', 'No student has that ID.');
        await tx.lockStudent(studentId);
        const endDate = endDateFor(startDate);
        const clash = await findOverlap(tx, studentId, { startDate, endDate }, null);
        if (clash) return overlapFailure(clash);

        const at = now();
        const appointmentId = await tx.insertAppointment({
          studentId,
          employeeId,
          startDate,
          endDate,
          purpose: purposeText,
          notes: notesText,
          date: at,
        });
        await tx.addHistory({ appointmentId, eventType: 'assigned', remarks: purposeText, employeeId, date: at });
        await tx.addNotification({
          studentId,
          title: 'SDO appointment scheduled',
          message: `You have an appointment with the SDO office: ${purposeText}. Visit any working day from ${range({ startDate, endDate })} (${HOURS}).`,
          appointmentId,
          idempotencyKey: `appt:${appointmentId}:new`,
        });
        return { ok: true as const, appointmentId };
      });
    },

    async update({ employeeId, appointmentId, startDate, purpose, notes, today }) {
      const wantsDate = startDate !== undefined;
      const wantsPurpose = purpose !== undefined;
      const wantsNotes = notes !== undefined;
      if (!wantsDate && !wantsPurpose && !wantsNotes) return fail('invalid_input', 'There is nothing to change.');

      let purposeText: string | undefined;
      if (wantsPurpose) {
        purposeText = required(purpose);
        if (purposeText === undefined) return fail('invalid_input', `A purpose cannot be empty (up to ${MAX_TEXT_LENGTH} characters).`);
      }
      let notesText: string | null | undefined;
      if (wantsNotes) {
        notesText = optional(notes);
        if (notesText === undefined) return fail('invalid_input', `Notes must be text up to ${MAX_TEXT_LENGTH} characters.`);
      }
      // Only a date that actually moves the window is checked against today and the 60-day limit (below, once
      // the current record is known): an unchanged start date may already be in the past.
      if (wantsDate && typeof startDate !== 'string') return fail('invalid_date', DATE_PROBLEM.format);

      return guarded(async (tx) => {
        const first = await tx.getAppointment(appointmentId);
        if (!first) return fail('not_found', 'Appointment not found.');
        await tx.lockStudent(first.studentId);
        const record = await tx.getAppointment(appointmentId);
        if (!record) return fail('not_found', 'Appointment not found.');
        if (!isLive(record)) return fail('invalid_status', 'Only a scheduled or rescheduled appointment can be changed.');

        const moving = wantsDate && startDate !== record.startDate;
        if (moving) {
          const check = checkStartDate(startDate as string, today);
          if (!check.ok) return fail('invalid_date', DATE_PROBLEM[check.reason]);
        }
        const purposeChanged = wantsPurpose && purposeText !== record.purpose;
        const notesChanged = wantsNotes && notesText !== record.notes;
        if (!moving && !purposeChanged && !notesChanged) {
          return fail('invalid_input', wantsDate && !wantsPurpose && !wantsNotes ? 'That is already the start date.' : 'There is nothing to change.');
        }

        const at = now();
        const patch: Parameters<AppointmentTx['updateAppointment']>[1] = { date: at };
        if (purposeChanged) patch.purpose = purposeText;
        if (notesChanged) patch.notes = notesText;

        let remarks: string;
        let eventType: 'rescheduled' | 'remarks_updated';
        let title: string;
        let message: string;
        let key: string;

        if (moving) {
          const newStart = startDate as string;
          const newEnd = endDateFor(newStart);
          const clash = await findOverlap(tx, record.studentId, { startDate: newStart, endDate: newEnd }, record.appointmentId);
          if (clash) return overlapFailure(clash);
          patch.startDate = newStart;
          patch.endDate = newEnd;
          patch.status = 'rescheduled';
          eventType = 'rescheduled';
          remarks = `Moved from ${friendly(record.startDate)} to ${friendly(newStart)}.`;
          title = 'SDO appointment rescheduled';
          message = `Your SDO appointment was moved. New window: ${range({ startDate: newStart, endDate: newEnd })} (${HOURS}).`;
          key = `appt:${record.appointmentId}:rescheduled:${at.getTime()}`;
        } else {
          eventType = 'remarks_updated';
          const parts: string[] = [];
          if (purposeChanged) parts.push(`Purpose: ${purposeText}`);
          if (notesChanged) parts.push(notesText === null ? 'Notes removed' : `Notes: ${notesText}`);
          remarks = parts.join('. ');
          title = 'SDO appointment updated';
          message = `Your SDO appointment (${range(record)}) was updated. ${remarks}.`;
          key = `appt:${record.appointmentId}:remarks:${at.getTime()}`;
        }

        await tx.updateAppointment(record.appointmentId, patch);
        await tx.addHistory({ appointmentId: record.appointmentId, eventType, remarks, employeeId, date: at });
        await tx.addNotification({
          studentId: record.studentId,
          title,
          message,
          appointmentId: record.appointmentId,
          idempotencyKey: key,
        });
        return { ok: true as const };
      });
    },

    async complete({ employeeId, appointmentId }) {
      return guarded(async (tx) => {
        const first = await tx.getAppointment(appointmentId);
        if (!first) return fail('not_found', 'Appointment not found.');
        await tx.lockStudent(first.studentId);
        const record = await tx.getAppointment(appointmentId);
        if (!record) return fail('not_found', 'Appointment not found.');
        if (!isLive(record)) return fail('invalid_status', 'Only a scheduled or rescheduled appointment can be completed.');

        const at = now();
        await tx.updateAppointment(appointmentId, { status: 'completed', date: at });
        await tx.addHistory({ appointmentId, eventType: 'completed', remarks: null, employeeId, date: at });
        await tx.addNotification({
          studentId: record.studentId,
          title: 'SDO appointment completed',
          message: `Your SDO appointment (${range(record)}) was marked completed.`,
          appointmentId,
          idempotencyKey: `appt:${appointmentId}:completed`,
        });
        return { ok: true as const };
      });
    },

    async cancel({ employeeId, appointmentId, reason }) {
      const text = required(reason);
      if (text === undefined) return fail('invalid_input', `A reason is required (up to ${MAX_TEXT_LENGTH} characters).`);
      return guarded(async (tx) => {
        const first = await tx.getAppointment(appointmentId);
        if (!first) return fail('not_found', 'Appointment not found.');
        await tx.lockStudent(first.studentId);
        const record = await tx.getAppointment(appointmentId);
        if (!record) return fail('not_found', 'Appointment not found.');
        if (!isLive(record)) return fail('invalid_status', 'Only a scheduled or rescheduled appointment can be cancelled.');

        const at = now();
        await tx.updateAppointment(appointmentId, { status: 'cancelled', cancelReason: text, date: at });
        await tx.addHistory({ appointmentId, eventType: 'cancelled', remarks: text, employeeId, date: at });
        await tx.addNotification({
          studentId: record.studentId,
          title: 'SDO appointment cancelled',
          message: `Your SDO appointment (${range(record)}) was cancelled. Reason: ${text}`,
          appointmentId,
          idempotencyKey: `appt:${appointmentId}:cancelled`,
        });
        return { ok: true as const };
      });
    },
  };
}
