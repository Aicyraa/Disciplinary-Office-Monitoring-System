import { APPOINTMENT_PAGE_SIZE, type AppointmentQueries, type AppointmentRow } from './queries.js';
import { windowsOverlap } from '../../domain/appointments/window.js';
import type {
  AppointmentHistoryInput,
  AppointmentNotificationInput,
  AppointmentRecord,
  AppointmentStore,
  AppointmentTx,
} from '../../types/appointments.types.js';

export interface MemoryAppointmentState {
  students: string[];
  appointments: AppointmentRecord[];
  history: AppointmentHistoryInput[];
  notifications: AppointmentNotificationInput[];
  nextId: number;
}

export interface MemoryAppointmentStore extends AppointmentStore {
  state: MemoryAppointmentState;
  /** Test hook: runs once, inside the next insert or update, before the exclusion check (a concurrent writer). */
  onNextWrite(hook: (state: MemoryAppointmentState) => void): void;
}

/** What Postgres raises for the exclusion constraint on `appointments`, so the service's mapping is testable. */
export function exclusionViolation(): Error {
  return new Error(
    'conflicting key value violates exclusion constraint "appointments_student_id_daterange_excl"',
  );
}

const live = (record: AppointmentRecord) => record.status === 'scheduled' || record.status === 'rescheduled';

/** Staff-side reads over the same fake data. Names come from the maps given here. */
export function createMemoryAppointmentQueries(
  store: MemoryAppointmentStore,
  names: { students?: Record<string, string>; staff?: Record<string, string> } = {},
): AppointmentQueries {
  const toRow = (record: AppointmentRecord): AppointmentRow => ({
    ...record,
    studentName: names.students?.[record.studentId] ?? record.studentId,
    assignedByName: names.staff?.[record.employeeId] ?? record.employeeId,
    history: store.state.history
      .filter((entry) => entry.appointmentId === record.appointmentId)
      .map((entry) => ({
        eventType: entry.eventType,
        remarks: entry.remarks,
        date: entry.date,
        by: names.staff?.[entry.employeeId] ?? entry.employeeId,
      })),
  });
  return {
    async list({ bucket, q, page, today }) {
      const needle = q?.trim().toLowerCase();
      const matching = store.state.appointments
        .filter((a) => (live(a) && a.endDate >= today ? 'upcoming' : 'history') === bucket)
        .map(toRow)
        .filter(
          (row) =>
            !needle ||
            row.studentId.toLowerCase().includes(needle) ||
            row.studentName.toLowerCase().includes(needle) ||
            row.purpose.toLowerCase().includes(needle),
        )
        .sort((a, b) =>
          bucket === 'upcoming'
            ? a.startDate.localeCompare(b.startDate) || a.appointmentId - b.appointmentId
            : b.startDate.localeCompare(a.startDate) || b.appointmentId - a.appointmentId,
        );
      return { rows: matching.slice((page - 1) * APPOINTMENT_PAGE_SIZE, page * APPOINTMENT_PAGE_SIZE), total: matching.length };
    },
    async get(appointmentId) {
      const found = store.state.appointments.find((a) => a.appointmentId === appointmentId);
      return found ? toRow(found) : null;
    },
  };
}

/**
 * In-memory fake of the appointment tables, with the database's exclusion constraint. A transaction works on
 * a copy and commits only if it finishes without throwing, like the real one.
 */
export function createMemoryAppointmentStore(seed: Partial<MemoryAppointmentState> = {}): MemoryAppointmentStore {
  const store: MemoryAppointmentStore = {
    state: {
      students: seed.students ?? [],
      appointments: seed.appointments ?? [],
      history: seed.history ?? [],
      notifications: seed.notifications ?? [],
      nextId: seed.nextId ?? 1,
    },
    onNextWrite(hook) {
      pendingHook = hook;
    },
    async transaction(work) {
      const working = structuredClone(store.state);
      const result = await work(createTx(working));
      store.state = working;
      return result;
    },
  };
  let pendingHook: ((state: MemoryAppointmentState) => void) | null = null;

  function enforceExclusion(state: MemoryAppointmentState, candidate: AppointmentRecord): void {
    if (!live(candidate)) return;
    const clash = state.appointments.some(
      (other) =>
        other.appointmentId !== candidate.appointmentId &&
        other.studentId === candidate.studentId &&
        live(other) &&
        windowsOverlap(other, candidate),
    );
    if (clash) throw exclusionViolation();
  }

  function createTx(state: MemoryAppointmentState): AppointmentTx {
    const runHook = () => {
      const hook = pendingHook;
      pendingHook = null;
      hook?.(state);
    };
    return {
      async lockStudent() {},
      async studentExists(studentId) {
        return state.students.includes(studentId);
      },
      async getAppointment(appointmentId) {
        const found = state.appointments.find((a) => a.appointmentId === appointmentId);
        return found ? { ...found } : null;
      },
      async listLiveForStudent(studentId) {
        return state.appointments.filter((a) => a.studentId === studentId && live(a)).map((a) => ({ ...a }));
      },
      async insertAppointment(input) {
        runHook();
        const record: AppointmentRecord = {
          appointmentId: state.nextId,
          studentId: input.studentId,
          employeeId: input.employeeId,
          startDate: input.startDate,
          endDate: input.endDate,
          purpose: input.purpose,
          notes: input.notes,
          status: 'scheduled',
          cancelReason: null,
          dateCreated: input.date,
        };
        enforceExclusion(state, record);
        state.nextId += 1;
        state.appointments.push(record);
        return record.appointmentId;
      },
      async updateAppointment(appointmentId, patch) {
        runHook();
        const index = state.appointments.findIndex((a) => a.appointmentId === appointmentId);
        if (index === -1) throw new Error(`No appointment ${appointmentId}`);
        const next: AppointmentRecord = { ...state.appointments[index] };
        if (patch.startDate !== undefined) next.startDate = patch.startDate;
        if (patch.endDate !== undefined) next.endDate = patch.endDate;
        if (patch.purpose !== undefined) next.purpose = patch.purpose;
        if (patch.notes !== undefined) next.notes = patch.notes;
        if (patch.status !== undefined) next.status = patch.status;
        if (patch.cancelReason !== undefined) next.cancelReason = patch.cancelReason;
        enforceExclusion(state, next);
        state.appointments[index] = next;
      },
      async addHistory(input) {
        state.history.push(input);
      },
      async addNotification(input) {
        if (state.notifications.some((n) => n.idempotencyKey === input.idempotencyKey)) return;
        state.notifications.push(input);
      },
    };
  }

  return store;
}
