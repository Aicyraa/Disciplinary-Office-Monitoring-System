import type { ClearanceTermView, StaffStudentRecord, StudentCaseView, StudentSanctionView } from '@shared/types';

/** Three minors of any kind become a Major (SPEC 4.2); the staff record shows how close a student is. */
export const MINOR_THRESHOLD = 3;

const ACTIVE_CASE_STATUSES: ReadonlyArray<StudentCaseView['status']> = ['reported', 'validated', 'for_sanction'];
const COUNTING_STATUSES: ReadonlyArray<StudentCaseView['status']> = ['validated', 'for_sanction', 'resolved'];

export function isActiveCase(item: StudentCaseView): boolean {
  return ACTIVE_CASE_STATUSES.includes(item.status);
}

/** Minors that count toward the next escalation: validated or later, not rejected, not already counted. */
export function countedMinors(cases: StudentCaseView[]): number {
  return cases.filter((item) => item.severity === 'Minor' && !item.isEscalated && COUNTING_STATUSES.includes(item.status)).length;
}

export interface StudentSummary {
  activeCases: number;
  resolvedCases: number;
  minorCount: number;
  sanctionsInProgress: number;
  sanctionsCleared: number;
  /** The newest clearance term, or null when none has been set up. */
  clearance: ClearanceTermView | null;
}

export function summarize(record: Pick<StaffStudentRecord, 'cases' | 'sanctions' | 'clearanceTerms'>): StudentSummary {
  const inProgress = (item: StudentSanctionView) => item.status !== 'completed';
  return {
    activeCases: record.cases.filter(isActiveCase).length,
    resolvedCases: record.cases.filter((item) => item.status === 'resolved').length,
    minorCount: Math.min(countedMinors(record.cases), MINOR_THRESHOLD),
    sanctionsInProgress: record.sanctions.filter(inProgress).length,
    sanctionsCleared: record.sanctions.filter((item) => !inProgress(item)).length,
    clearance: record.clearanceTerms[0] ?? null,
  };
}

/** The list filter of the Students page: free text over name, id, email and program. */
export function matchesStudent(
  row: { studentId: string; firstName: string; lastName: string; email: string; program: string },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  return [row.studentId, `${row.firstName} ${row.lastName}`, row.email, row.program].some((text) => text.toLowerCase().includes(needle));
}
