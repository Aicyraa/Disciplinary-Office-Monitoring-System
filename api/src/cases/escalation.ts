import type { CaseStatus, Severity } from '../../../shared/types.js';

/** SPEC 4.2: three minors of any kind. The one place the threshold lives, so it can change later. */
export function escalationThreshold(): number {
  return 3;
}

export interface EscalationCandidate {
  caseId: number;
  caseDate: Date;
  status: CaseStatus;
  /** Severity of the case's current handbook entry. A converted case is Major (H068). */
  severity: Severity;
  isEscalated: boolean;
}

export interface EscalationGroup {
  /** The case that becomes the Major "3 minor offense". */
  majorCaseId: number;
  /** The earlier minors, flagged as escalated and linked to the major. */
  minorCaseIds: number[];
}

const COUNTED_STATUSES: ReadonlySet<CaseStatus> = new Set(['validated', 'for_sanction', 'resolved']);

/** SPEC 4.2: validated or later, Minor, not rejected, not already escalated. Oldest first (case_date, then id). */
export function countedMinors<T extends EscalationCandidate>(cases: readonly T[]): T[] {
  return cases
    .filter((c) => COUNTED_STATUSES.has(c.status) && c.severity === 'Minor' && !c.isEscalated)
    .sort((a, b) => a.caseDate.getTime() - b.caseDate.getTime() || a.caseId - b.caseId);
}

/**
 * Groups the counted minors in threes (SPEC 4.2): within each group the last case converts to the Major and
 * the earlier ones are flagged. Leftover minors (fewer than a full group) keep waiting. Pure: it plans, the
 * caller applies the plan inside one transaction.
 */
export function planEscalations(
  cases: readonly EscalationCandidate[],
  threshold: number = escalationThreshold(),
): EscalationGroup[] {
  if (!Number.isInteger(threshold) || threshold < 2) {
    throw new Error(`Escalation threshold must be an integer of at least 2, got ${threshold}`);
  }
  const counted = countedMinors(cases);
  const groups: EscalationGroup[] = [];
  for (let start = 0; start + threshold <= counted.length; start += threshold) {
    const group = counted.slice(start, start + threshold);
    groups.push({
      majorCaseId: group[group.length - 1].caseId,
      minorCaseIds: group.slice(0, -1).map((c) => c.caseId),
    });
  }
  return groups;
}
