import type { AppointmentStatus } from '@shared/types.js';

export type AppointmentEventType = 'assigned' | 'rescheduled' | 'remarks_updated' | 'completed' | 'cancelled';

/** An appointment as the domain needs it. Dates are calendar days (YYYY-MM-DD, Asia/Manila). */
export interface AppointmentRecord {
  appointmentId: number;
  studentId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  purpose: string;
  notes: string | null;
  status: AppointmentStatus;
  cancelReason: string | null;
  dateCreated: Date;
}

export interface NewAppointmentInput {
  studentId: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  purpose: string;
  notes: string | null;
  date: Date;
}

export interface AppointmentPatch {
  startDate?: string;
  endDate?: string;
  purpose?: string;
  notes?: string | null;
  status?: AppointmentStatus;
  cancelReason?: string | null;
  date: Date;
}

export interface AppointmentHistoryInput {
  appointmentId: number;
  eventType: AppointmentEventType;
  remarks: string | null;
  employeeId: string;
  date: Date;
}

export interface AppointmentNotificationInput {
  studentId: string;
  title: string;
  message: string;
  /** Deep link: the student's appointments page. */
  appointmentId: number;
  /** The same update is never stored twice (FEATURE-RULES 3.10). */
  idempotencyKey: string;
}

/** Everything the appointment workflow reads and writes, scoped to one database transaction. */
export interface AppointmentTx {
  /** Serialises changes for one student (SELECT ... FOR UPDATE on the account). */
  lockStudent(studentId: string): Promise<void>;
  studentExists(studentId: string): Promise<boolean>;
  getAppointment(appointmentId: number): Promise<AppointmentRecord | null>;
  /** The student's `scheduled` and `rescheduled` appointments. */
  listLiveForStudent(studentId: string): Promise<AppointmentRecord[]>;
  insertAppointment(input: NewAppointmentInput): Promise<number>;
  updateAppointment(appointmentId: number, patch: AppointmentPatch): Promise<void>;
  addHistory(input: AppointmentHistoryInput): Promise<void>;
  /** Idempotent: an existing key is left alone. */
  addNotification(input: AppointmentNotificationInput): Promise<void>;
}

export interface AppointmentStore {
  /** Runs `work` atomically: every write commits together or none do. */
  transaction<T>(work: (tx: AppointmentTx) => Promise<T>): Promise<T>;
}
