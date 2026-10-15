import type { AppointmentStatus, StaffAppointmentView } from '@shared/types';
import type { GroupTone } from '@/components/ui/GroupHead';
import type { HistoryItem } from '@/components/ui/HistoryList';
import { ordinalYear } from './account';
import { dayRange } from './staffDashboard';
import { appointmentEndDate, MAX_DAYS_AHEAD } from './workingDays';

/** Staff Appointments, Make and Edit (deck W36 to W43, src 3159 to 3265). The API decides every rule. */

export const OFFICE_HOURS = '7:00 AM to 5:00 PM';

const STATUS_WORDS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  rescheduled: 'Rescheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const RANGE_OPTIONS = [
  { value: '', label: 'All dates' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Next 7 days' },
  { value: 'past', label: 'Past' },
] as const;

export function statusOptions(counts: Record<AppointmentStatus, number> | null): Array<{ value: AppointmentStatus | ''; label: string }> {
  const n = (value: number) => (counts ? ` (${value})` : '');
  const all = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : 0;
  return [
    { value: '', label: `All statuses${n(all)}` },
    ...(Object.keys(STATUS_WORDS) as AppointmentStatus[]).map((status) => ({ value: status, label: `${STATUS_WORDS[status]}${n(counts?.[status] ?? 0)}` })),
  ];
}

/** "UPCOMING 3" (primary dot) before the first upcoming row, "PAST AND CLOSED 2" (grey) before the first closed one. */
export function groupHeadsFor(
  rows: ReadonlyArray<Pick<StaffAppointmentView, 'id' | 'bucket'>>,
  counts: { upcoming: number; closed: number },
): Map<number, { label: string; tone: GroupTone; count: number }> {
  const heads = new Map<number, { label: string; tone: GroupTone; count: number }>();
  rows.forEach((row, index) => {
    if (index > 0 && rows[index - 1].bucket === row.bucket) return;
    heads.set(
      row.id,
      row.bucket === 'upcoming' ? { label: 'Upcoming', tone: 'info', count: counts.upcoming } : { label: 'Past and closed', tone: 'neutral', count: counts.closed },
    );
  });
  return heads;
}

/** "Mon, Oct 12 to Sat, Oct 17, 7:00 AM to 5:00 PM" (modal bodies). */
export const whenText = (a: Pick<StaffAppointmentView, 'startDate' | 'endDate'>): string => `${dayRange(a.startDate, a.endDate)}, ${OFFICE_HOURS}`;

/** "BSIT · 3rd Year", or empty when the API did not send them. */
export function studentMeta(a: Pick<StaffAppointmentView, 'student'>): string {
  const { program, yearLevel } = a.student;
  return [program, yearLevel ? ordinalYear(yearLevel) : null].filter(Boolean).join(' · ');
}

const longDate = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));

function sentence(entry: StaffAppointmentView['history'][number]): string {
  const remarks = entry.remarks?.trim() ?? '';
  switch (entry.eventType) {
    case 'assigned':
      return remarks ? `Assigned: ${remarks}` : 'Assigned';
    case 'rescheduled':
      return remarks ? remarks.replace(/^Moved/, 'Rescheduled') : 'Rescheduled';
    case 'remarks_updated':
      return 'Reason or remarks updated';
    case 'completed':
      return 'Marked completed';
    case 'cancelled':
      return remarks ? `Cancelled: ${remarks}` : 'Cancelled';
  }
}

export function appointmentHistory(a: Pick<StaffAppointmentView, 'history'>): HistoryItem[] {
  return a.history.map((entry, index) => ({ id: index, date: longDate(entry.date), text: sentence(entry), by: entry.by })).reverse();
}

export function lastUpdated(a: Pick<StaffAppointmentView, 'history' | 'dateCreated'>): string {
  const newest = a.history.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), a.dateCreated);
  return longDate(newest);
}

/* ---- Make / Edit form ---- */

const DAY_MS = 86_400_000;
const toMs = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const fromMs = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const longDay = (day: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${day}T00:00:00Z`));
const lastBookable = (today: string): string => fromMs(toMs(today) + MAX_DAYS_AHEAD * DAY_MS);

/** The deck's start date messages (src 3199). */
export function startDateError(day: string, today: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return 'Choose a start date.';
  if (day < today) return 'Choose today or a later date.';
  const max = lastBookable(today);
  if (day > max) return `Choose a start date before ${longDay(fromMs(toMs(max) + DAY_MS))}.`;
  if (new Date(toMs(day)).getUTCDay() === 0) return 'The office is closed on Sundays. Choose Monday to Saturday.';
  return null;
}

export type CalendarCell =
  | { kind: 'blank'; day: null; date: null; today: false }
  | { kind: 'available' | 'unavailable' | 'start' | 'window'; day: number; date: string; today: boolean };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** One month of the start-date calendar: Sunday first; `month` is 0-based. */
export function calendarMonth(
  year: number,
  month: number,
  today: string,
  selected: string,
): { title: string; cells: CalendarCell[]; canPrev: boolean; canNext: boolean } {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const windowEnd = selected ? appointmentEndDate(selected) : null;
  const cells: CalendarCell[] = Array.from({ length: first }, () => ({ kind: 'blank', day: null, date: null, today: false }) as const);
  for (let day = 1; day <= days; day += 1) {
    const date = fromMs(Date.UTC(year, month, day));
    const sunday = new Date(toMs(date)).getUTCDay() === 0;
    const kind =
      date === selected
        ? 'start'
        : windowEnd && date > selected && date <= windowEnd && !sunday
          ? 'window'
          : startDateError(date, today)
            ? 'unavailable'
            : 'available';
    cells.push({ kind, day, date, today: date === today });
  }
  const index = year * 12 + month;
  const at = (day: string) => Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;
  return { title: `${MONTHS[month]} ${year}`, cells, canPrev: index > at(today), canNext: index < at(lastBookable(today)) };
}

export function formErrors(
  input: { studentFound: boolean; studentTyped: string; startDate: string; reason: string },
  today: string,
): { student?: string; date?: string; reason?: string } {
  const errors: { student?: string; date?: string; reason?: string } = {};
  if (!input.studentFound) errors.student = input.studentTyped.trim() ? 'No student found with that ID.' : 'Enter the student ID.';
  const date = startDateError(input.startDate, today);
  if (date) errors.date = date;
  if (!input.reason.trim()) errors.reason = 'Enter the reason for the appointment.';
  return errors;
}

export const overlapMessage = (name: string, other: Pick<StaffAppointmentView, 'code' | 'startDate' | 'endDate'>): string =>
  `${name} already has appointment ${other.code} (${dayRange(other.startDate, other.endDate)}) in this period.`;

const rangeFrom = (start: string): string => dayRange(start, appointmentEndDate(start) ?? start);

export function reviewRows(input: { name: string; studentId: string; startDate: string; reason: string; remarks: string; status: string }): Array<[string, string]> {
  return [
    ['Student', input.name],
    ['Student ID', input.studentId],
    ['Dates', rangeFrom(input.startDate)],
    ['Time', `Any time during office hours, ${OFFICE_HOURS}`],
    ['Reason', input.reason.trim()],
    ['Remarks', input.remarks.trim() || 'None'],
    ['Status', input.status],
  ];
}

export function reviewNote(kind: 'new' | 'moved' | 'edited', name: string): string {
  if (kind === 'new') return `Saving assigns this appointment to ${name}. They get a portal notification and an email.`;
  if (kind === 'moved') return `Saving moves the appointment and tells ${name} the new date.`;
  return `Saving updates the appointment and notifies ${name}.`;
}

export function appointmentToasts(code: string, name: string) {
  return {
    assigned: `${code} assigned to ${name}. They were notified.`,
    moved: (start: string) => `${code} moved to ${rangeFrom(start)}. ${name} was notified.`,
    updated: `${code} updated. ${name} was notified.`,
    completed: `${code} completed. ${name} was notified.`,
    cancelled: `${code} cancelled. ${name} was notified.`,
  };
}
