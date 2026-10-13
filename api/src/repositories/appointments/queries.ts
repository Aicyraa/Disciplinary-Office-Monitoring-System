import type { AppointmentEventType, AppointmentRecord } from '../../types/appointments.types.js';

export const APPOINTMENT_PAGE_SIZE = 10;

export interface AppointmentListFilter {
  /** `upcoming`: live and the window has not ended; `history`: everything else. */
  bucket: 'upcoming' | 'history';
  /** Case-insensitive match on the student's id or name, or the purpose. */
  q?: string;
  page: number;
  /** Asia/Manila calendar day, YYYY-MM-DD. */
  today: string;
}

export interface AppointmentRow extends AppointmentRecord {
  studentName: string;
  assignedByName: string;
  history: Array<{ eventType: AppointmentEventType; remarks: string | null; date: Date; by: string }>;
}

export interface AppointmentQueries {
  list(filter: AppointmentListFilter): Promise<{ rows: AppointmentRow[]; total: number }>;
  get(appointmentId: number): Promise<AppointmentRow | null>;
}
