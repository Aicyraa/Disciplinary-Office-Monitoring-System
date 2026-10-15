import type { ClearanceStatus, RequirementStatus } from '../../repositories/clearance/types.js';

/**
 * The inactive employee account that automatic jobs act as (the Power Automate term set-up). It cannot sign in;
 * it exists so `clearances.employee_id` and `clearance_history.employee_id` show the change was automatic.
 */
export const SYSTEM_EMPLOYEE_ID = 'SYSTEM';

/** The seeded default requirement that the warning chip is about (SPEC 4.4). */
export const NO_ACTIVE_VIOLATIONS_LABEL = 'No active violations';

/**
 * A clearance is `cleared` when it has at least one item and every item is completed (SPEC 4.4). This is a
 * pure function of the checklist: staff mark the items by hand and nothing here looks at cases or sanctions.
 */
export function nextClearanceStatus(items: ReadonlyArray<{ status: RequirementStatus }>): ClearanceStatus {
  return items.length > 0 && items.every((entry) => entry.status === 'completed') ? 'cleared' : 'pending';
}

/** A term is a four-digit school start year and a semester from 1 to 3. */
export function checkTerm(academicYear: unknown, semester: unknown): boolean {
  return (
    typeof academicYear === 'number' &&
    Number.isInteger(academicYear) &&
    academicYear >= 1000 &&
    academicYear <= 9999 &&
    typeof semester === 'number' &&
    Number.isInteger(semester) &&
    semester >= 1 &&
    semester <= 3
  );
}

export const termLabel = (academicYear: number, semester: number): string =>
  `${academicYear}-${academicYear + 1}, Semester ${semester}`;
