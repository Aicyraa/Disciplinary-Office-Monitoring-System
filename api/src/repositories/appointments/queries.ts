import type { AppointmentStatus } from '@shared/types.js';
import type { AppointmentEventType, AppointmentRecord } from '../../types/appointments.types.js';

/** 5 per page, as the deck's Appointments list (UI-POLISH-SPEC 5.4c). */
export const APPOINTMENT_PAGE_SIZE = 5;

export type AppointmentRange = 'today' | 'week' | 'past';

export interface AppointmentListFilter {
  /** `upcoming`: live and the window has not ended; `history`: everything else; `all`: both, upcoming first. */
  bucket: 'upcoming' | 'history' | 'all';
  /** Case-insensitive match on the student's id or name, the purpose, or the code (`A-104`). */
  q?: string;
  status?: AppointmentStatus;
  /** `today`: the window holds today; `week`: it overlaps the next 7 days; `past`: it ended before today. */
  range?: AppointmentRange;
  /** YYYY-MM-DD: the window holds this day (wins over `range`). */
  on?: string;
  page: number;
  /** Answer the page that holds this appointment instead of `page` (deep links); ignored when no match holds it. */
  focus?: number;
  /** Asia/Manila calendar day, YYYY-MM-DD. */
  today: string;
}

export interface AppointmentRow extends AppointmentRecord {
  studentName: string;
  studentProgram: string | null;
  studentYearLevel: number | null;
  assignedByName: string;
  history: Array<{ eventType: AppointmentEventType; remarks: string | null; date: Date; by: string }>;
}

export interface AppointmentListResult {
  rows: AppointmentRow[];
  total: number;
  /** The page answered (differs from the asked page when `focus` moved it). */
  page: number;
  /** Matches per group, for the "UPCOMING 3" / "PAST AND CLOSED 2" heads. */
  counts: { upcoming: number; closed: number };
  /** Every appointment per status, for the status menu (the deck counts the whole office). */
  statusCounts: Record<AppointmentStatus, number>;
}

export interface AppointmentQueries {
  list(filter: AppointmentListFilter): Promise<AppointmentListResult>;
  get(appointmentId: number): Promise<AppointmentRow | null>;
}

export interface AppointmentKey {
  id: number;
  status: AppointmentStatus;
  startDate: string;
  endDate: string;
}

const live = (status: AppointmentStatus) => status === 'scheduled' || status === 'rescheduled';

export const isUpcoming = (key: Pick<AppointmentKey, 'status' | 'endDate'>, today: string): boolean => live(key.status) && key.endDate >= today;

const addDays = (day: string, days: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The bucket, status and date filters (src 3164, 3165). Search is matched by each store. */
export function matchesAppointmentFilter(key: AppointmentKey, filter: AppointmentListFilter): boolean {
  if (filter.bucket === 'upcoming' && !isUpcoming(key, filter.today)) return false;
  if (filter.bucket === 'history' && isUpcoming(key, filter.today)) return false;
  if (filter.status && key.status !== filter.status) return false;
  if (filter.on) return key.startDate <= filter.on && filter.on <= key.endDate;
  if (filter.range === 'today') return key.startDate <= filter.today && filter.today <= key.endDate;
  if (filter.range === 'week') return key.startDate <= addDays(filter.today, 7) && key.endDate >= filter.today;
  if (filter.range === 'past') return key.endDate < filter.today;
  return true;
}

/** Upcoming first, soonest first; then past and closed, newest first. */
export function orderAppointments<T extends AppointmentKey>(keys: readonly T[], today: string): T[] {
  const up = keys.filter((k) => isUpcoming(k, today)).sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id);
  const closed = keys.filter((k) => !isUpcoming(k, today)).sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id);
  return [...up, ...closed];
}

/** "A-104", "a104" or "104" typed in the search: the appointment id, or null. */
export function appointmentIdFromCode(text: string): number | null {
  const match = /^a-?0*(\d{1,9})$/i.exec(text.trim());
  return match ? Number(match[1]) : null;
}

/** Orders the matches, picks the page (the one holding `focus` when given) and counts the groups. */
export function pageAppointments<T extends AppointmentKey>(
  matches: readonly T[],
  filter: Pick<AppointmentListFilter, 'page' | 'focus' | 'today'>,
): { page: number; pageKeys: T[]; total: number; counts: { upcoming: number; closed: number } } {
  const ordered = orderAppointments(matches, filter.today);
  const index = filter.focus === undefined ? -1 : ordered.findIndex((k) => k.id === filter.focus);
  const page = index < 0 ? filter.page : Math.floor(index / APPOINTMENT_PAGE_SIZE) + 1;
  const upcoming = ordered.filter((k) => isUpcoming(k, filter.today)).length;
  return {
    page,
    pageKeys: ordered.slice((page - 1) * APPOINTMENT_PAGE_SIZE, page * APPOINTMENT_PAGE_SIZE),
    total: ordered.length,
    counts: { upcoming, closed: ordered.length - upcoming },
  };
}

export function emptyAppointmentCounts(): Record<AppointmentStatus, number> {
  return { scheduled: 0, rescheduled: 0, completed: 0, cancelled: 0 };
}
