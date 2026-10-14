import type { CaseStatus } from '@shared/types.js';

/** Every case status, in the order of the workflow (SPEC 4.1). */
export const CASE_STATUSES: readonly CaseStatus[] = ['reported', 'validated', 'for_sanction', 'resolved', 'rejected'];

/** Statuses that still need staff or student action; "resolved" and "rejected" are closed. */
export const OPEN_CASE_STATUSES: readonly CaseStatus[] = ['reported', 'validated', 'for_sanction'];
