import type { ClearanceRosterRow, StaffAppointmentView, StaffCaseRow, StaffSanctionQueueRow, TermRef } from '@shared/types';
import { violationTitle } from '@/utils/format';

/** The staff dashboard's row rules (deck W15, src 2822 to 2871). Every row links to its record (UI-POLISH-SPEC 5.4b). */

const DAY_MS = 86_400_000;
const manilaDay = (iso: string): string => new Date(new Date(iso).getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
const dayNumber = (day: string): number => Date.parse(`${day}T00:00:00Z`) / DAY_MS;

/** "Today", "1 day", "38 days": how long a case has waited, in Manila days. */
export function ageText(iso: string, today: string): string {
  const days = Math.max(0, Math.round(dayNumber(today) - dayNumber(manilaDay(iso))));
  return days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`;
}

const shortDay = (day: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${day}T00:00:00Z`));
const monthDay = (day: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }).format(new Date(`${day}T00:00:00Z`));

/** "Sat, Oct 10 to Fri, Oct 16": an appointment window. */
export const dayRange = (start: string, end: string): string => `${shortDay(start)} to ${shortDay(end)}`;

const who = (row: Pick<StaffCaseRow, 'student' | 'claimed'>): string => {
  if (row.student) return `${row.student.name} · ${row.student.id}`;
  return `${row.claimed?.name ?? 'Unknown student'} · ${row.claimed?.studentId ?? 'no ID'}`;
};

export interface ReportRow {
  key: string;
  caseId: number;
  title: string;
  sub: string;
  submissionRef: string | null;
  unmatched: boolean;
  href: string;
}

/** Reports to validate: one row per gate submission, all its violations on one line (D4). Oldest first. */
export function reportRows(cases: StaffCaseRow[], today: string): ReportRow[] {
  const groups = new Map<string, StaffCaseRow[]>();
  for (const row of cases) {
    const key = row.submissionRef ?? `case-${row.id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, rows]) => {
    const first = rows[0];
    return {
      key,
      caseId: first.id,
      title: who(first),
      sub: [first.submissionCode ?? first.code, rows.map((r) => violationTitle(r.violation)).join(', '), ageText(first.caseDate, today)].join(' · '),
      submissionRef: first.submissionRef,
      unmatched: first.student === null,
      href: `/cases/${first.id}?queue=review`,
    };
  });
}

export interface DashRow {
  key: string;
  title: string;
  sub: string;
  flag: string | null;
  href: string;
}

export function decisionRow(row: StaffCaseRow, today: string): DashRow {
  return {
    key: String(row.id),
    title: `${row.student?.name ?? 'Unknown student'} · ${row.code}`,
    sub: `${violationTitle(row.violation)} · ${row.severity} · ${ageText(row.caseDate, today)}`,
    flag: row.severity === 'Major' ? 'Major' : null,
    href: `/cases/${row.id}?queue=all`,
  };
}

export function appointmentRow(appointment: StaffAppointmentView, today: string): DashRow {
  return {
    key: String(appointment.id),
    title: `${appointment.student.name} · ${appointment.code}`,
    sub: `${appointment.purpose} · ${dayRange(appointment.startDate, appointment.endDate)}`,
    flag: appointment.startDate <= today ? 'Window open' : appointment.status === 'rescheduled' ? 'Rescheduled' : null,
    href: `/appointments/${appointment.id}`,
  };
}

/** Sanctions: the ones waiting for verification first, then those in progress (4 shown). */
export function sanctionRows(rows: StaffSanctionQueueRow[]): Array<DashRow & { action: 'Verify' | 'Open' }> {
  const toVerify = rows.filter((row) => row.status === 'pending_verification');
  const rest = rows.filter((row) => row.status !== 'pending_verification');
  return [...toVerify, ...rest].map((row) => ({
    key: String(row.id),
    title: `${row.student?.name ?? 'Unknown student'} · ${row.sanctionCode}`,
    sub: `${row.type} · Due ${monthDay(row.dueDate)}`,
    flag: row.status === 'pending_verification' ? null : row.overdue ? 'Overdue' : row.status === 'returned' ? 'Returned' : null,
    action: row.status === 'pending_verification' ? 'Verify' : 'Open',
    href: `/cases/${row.caseId}?queue=sanction`,
  }));
}

/** Clearance work: students of the current term who are not cleared, set up or not (D3). */
export function clearanceRows(rows: ClearanceRosterRow[], term: TermRef): DashRow[] {
  return rows
    .filter((row) => row.clearance?.status !== 'cleared')
    .map((row) => ({
      key: row.studentId,
      title: `${row.name} · ${row.studentId}`,
      sub: row.clearance ? `${row.clearance.done} of ${row.clearance.total} requirements done` : 'Not set up for this term',
      flag: row.clearance ? null : 'Not set',
      href: `/clearance/${row.studentId}?term=${term.academicYear}-${term.semester}`,
    }));
}
