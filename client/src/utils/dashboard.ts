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
