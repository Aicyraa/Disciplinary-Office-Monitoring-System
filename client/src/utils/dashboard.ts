import type {
  CaseStatus,
  StudentAppointmentView,
  StudentCaseView,
  StudentClearanceView,
  StudentSanctionView,
} from '@shared/types';

/** Dashboard summaries (UI-POLISH-SPEC P1). Pure, so the cards are tested without a DOM or an API. */

const CLOSED: ReadonlySet<CaseStatus> = new Set(['resolved', 'rejected']);

/** The student's cases that are still open (not resolved, not rejected), newest first. */
export function activeCases<T extends Pick<StudentCaseView, 'status' | 'caseDate' | 'id'>>(cases: readonly T[]): T[] {
  return cases
    .filter((c) => !CLOSED.has(c.status))
    .sort((a, b) => b.caseDate.localeCompare(a.caseDate) || b.id - a.id);
}

export interface CaseCounts {
  /** `reported`: waiting for staff to validate. */
  pendingReview: number;
  validated: number;
  /** `for_sanction`: a sanction was assigned. */
  sanctioned: number;
  active: number;
  /** Minor and Major among the active cases. */
  minor: number;
  major: number;
}

export function caseCounts(cases: ReadonlyArray<Pick<StudentCaseView, 'status' | 'severity'>>): CaseCounts {
  const open = cases.filter((c) => !CLOSED.has(c.status));
  return {
    pendingReview: cases.filter((c) => c.status === 'reported').length,
    validated: cases.filter((c) => c.status === 'validated').length,
    sanctioned: cases.filter((c) => c.status === 'for_sanction').length,
    active: open.length,
    minor: open.filter((c) => c.severity === 'Minor').length,
    major: open.filter((c) => c.severity === 'Major').length,
  };
}

/** The upcoming appointment that starts first, or null. */
export function nextAppointment<T extends Pick<StudentAppointmentView, 'bucket' | 'startDate' | 'id'>>(
  appointments: readonly T[],
): T | null {
  const upcoming = appointments
    .filter((a) => a.bucket === 'upcoming')
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.id - b.id);
  return upcoming[0] ?? null;
}

export interface SanctionCounts {
  /** `assigned` and `returned`: the student has something to do. */
  inProgress: number;
  pendingVerification: number;
  /** `completed`. */
  cleared: number;
  /** Everything not completed. */
  active: number;
  total: number;
}

export function sanctionCounts(sanctions: ReadonlyArray<Pick<StudentSanctionView, 'status'>>): SanctionCounts {
  const inProgress = sanctions.filter((s) => s.status === 'assigned' || s.status === 'returned').length;
  const pendingVerification = sanctions.filter((s) => s.status === 'pending_verification').length;
  const cleared = sanctions.filter((s) => s.status === 'completed').length;
  return { inProgress, pendingVerification, cleared, active: inProgress + pendingVerification, total: sanctions.length };
}

/** "1 of 4 requirements done" as numbers and a whole percent. Nothing set up reads 0 of 0. */
export function clearanceProgress(clearance: Pick<StudentClearanceView, 'items'> | null): {
  done: number;
  total: number;
  percent: number;
} {
  const items = clearance?.items ?? [];
  const done = items.filter((item) => item.status === 'completed').length;
  return { done, total: items.length, percent: items.length === 0 ? 0 : Math.round((done / items.length) * 100) };
}

/* The student dashboard's rows (deck W57, src 3062 to 3067). Every row opens its record (UI-POLISH-SPEC 5.4b). */

const shortDate = (value: string): string => {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return new Intl.DateTimeFormat('en-US', { timeZone: dateOnly ? 'UTC' : 'Asia/Manila', month: 'short', day: 'numeric' }).format(
    new Date(dateOnly ? `${value}T00:00:00Z` : value),
  );
};
const weekdayDate = (day: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${day}T00:00:00Z`));

export interface StudentDashRow {
  key: string;
  title: string;
  sub: string;
  href: string;
}

export const violationsHint = (counts: CaseCounts): string => (counts.active ? `${counts.minor} minor · ${counts.major} major` : 'Nothing open');

export function violationRow(row: Pick<StudentCaseView, 'id' | 'code' | 'violation' | 'severity' | 'caseDate'>): StudentDashRow {
  return { key: String(row.id), title: row.violation, sub: `${row.code} · ${row.severity} · ${shortDate(row.caseDate)}`, href: `/violations/${row.id}` };
}

export const sanctionsHint = (counts: SanctionCounts): string => `${counts.active} active · ${counts.cleared} of ${counts.total} cleared`;

export function sanctionRow(row: Pick<StudentSanctionView, 'id' | 'type' | 'sanctionCode' | 'dueDate'>): StudentDashRow {
  return { key: String(row.id), title: row.type, sub: `${row.sanctionCode} · Due ${shortDate(row.dueDate)}`, href: `/sanctions/${row.id}` };
}

/** The Next appointment card: its subtitle, the window and where the card goes. */
export function appointmentSummary(
  next: Pick<StudentAppointmentView, 'id' | 'startDate' | 'endDate'> | null,
  upcoming: number,
): { sub: string; range: string; href: string } {
  return {
    sub: upcoming ? `${upcoming} upcoming` : 'Nothing scheduled',
    range: next ? `${weekdayDate(next.startDate)} to ${weekdayDate(next.endDate)}` : '',
    href: next ? `/appointments/${next.id}` : '/appointments',
  };
}

/** The Clearance card: "2/4" (or "Cleared"), the hint and the bar. Null when nothing is set up for the term. */
export function clearanceSummary(
  clearance: Pick<StudentClearanceView, 'status' | 'items'> | null,
): { value: string; hint: string; percent: number; cleared: boolean } | null {
  if (!clearance) return null;
  const { done, total, percent } = clearanceProgress(clearance);
  const cleared = clearance.status === 'cleared';
  return { value: cleared ? 'Cleared' : `${done}/${total}`, hint: `${done} of ${total} requirements done`, percent, cleared };
}
