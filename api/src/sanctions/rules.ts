import type { CaseSanctionStatus, CaseStatus } from '@shared/types.js';

export interface OffenseCase {
  caseId: number;
  caseDate: Date;
  status: CaseStatus;
  /** The case's current handbook entry. A converted Major is H068 here, so it counts against H068. */
  handbookEntryId: number;
}

const COUNTS_TOWARD_OFFENSE: ReadonlySet<CaseStatus> = new Set(['validated', 'for_sanction', 'resolved']);

/**
 * SPEC 4.3 / decision 14: 1 + the number of the same student's earlier cases for the same violation whose
 * status is validated, for_sanction or resolved, ordered by case_date then id. Never typed by staff.
 * `studentCases` is every case of the student (it may include the target itself).
 */
export function offenseNumber(target: OffenseCase, studentCases: readonly OffenseCase[]): number {
  const earlier = studentCases.filter(
    (c) =>
      c.caseId !== target.caseId &&
      c.handbookEntryId === target.handbookEntryId &&
      COUNTS_TOWARD_OFFENSE.has(c.status) &&
      (c.caseDate.getTime() < target.caseDate.getTime() ||
        (c.caseDate.getTime() === target.caseDate.getTime() && c.caseId < target.caseId)),
  );
  return 1 + earlier.length;
}

export interface HandbookSanctionRow {
  offenseNumber: number;
  sanctionId: number;
  sanctionType: string;
}

/**
 * The sanctions the handbook allows for an offense number. If that number has no row, the highest defined
 * offense number for the violation is used (SPEC 4.3). `offenseUsed` is null when nothing is defined at all.
 */
export function allowedSanctions(
  rows: readonly HandbookSanctionRow[],
  offense: number,
): { offenseUsed: number | null; sanctions: HandbookSanctionRow[] } {
  if (rows.length === 0) return { offenseUsed: null, sanctions: [] };
  const defined = new Set(rows.map((row) => row.offenseNumber));
  const offenseUsed = defined.has(offense) ? offense : Math.max(...defined);
  return { offenseUsed, sanctions: rows.filter((row) => row.offenseNumber === offenseUsed) };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (isoDate: string): number => Math.floor(Date.parse(`${isoDate}T00:00:00Z`) / DAY_MS);

/**
 * "Late by N days" (SPEC 4.3): derived from `due_date`, never stored. Dates are Asia/Manila calendar days as
 * YYYY-MM-DD. A completed sanction is measured at its completion day instead of today.
 */
export function lateByDays(input: {
  dueDate: string;
  status: CaseSanctionStatus;
  today: string;
  completedOn?: string | null;
}): number {
  const reference = input.status === 'completed' && input.completedOn ? input.completedOn : input.today;
  return Math.max(0, dayNumber(reference) - dayNumber(input.dueDate));
}
