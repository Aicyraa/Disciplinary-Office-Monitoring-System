import type {
  CaseStatus,
  Severity,
  StaffCaseDetail,
  StaffCaseRow,
  StaffSanctionQueueResponse,
} from '@shared/types.js';

export const CASE_PAGE_SIZE = 6;

export const ALL_CASE_STATUSES: readonly CaseStatus[] = ['reported', 'validated', 'for_sanction', 'resolved', 'rejected'];

export function emptyStatusCounts(): Record<CaseStatus, number> {
  return { reported: 0, validated: 0, for_sanction: 0, resolved: 0, rejected: 0 };
}
export const SANCTION_QUEUE_PAGE_SIZE = 20;

/** Sanctions the student still owes or staff still have to verify. */
export const ACTIVE_SANCTION_STATUSES = ['assigned', 'pending_verification', 'returned'] as const;

export type SanctionQueueFilter = 'pending_verification' | 'overdue' | 'active';

export interface SanctionQueueQuery {
  filter: SanctionQueueFilter;
  /** 1-based. */
  page: number;
  /** The Asia/Manila calendar day (YYYY-MM-DD): what "overdue" is measured against. */
  today: string;
}

export interface CaseListFilter {
  status?: CaseStatus;
  severity?: Severity;
  /** Free text: student id or name, violation, or a case code such as SDO-2026-016. */
  q?: string;
  sort: 'newest' | 'oldest';
  /** 1-based. */
  page: number;
}

/** Read side of the staff case screens. Writes go through the CaseService. */
export interface CaseQueries {
  list(filter: CaseListFilter): Promise<{ rows: StaffCaseRow[]; total: number; statusCounts: Record<CaseStatus, number> }>;
  /** `today` is the Asia/Manila calendar day, for the derived "late by N days" of each sanction. */
  detail(caseId: number, today: string): Promise<StaffCaseDetail | null>;
  /** The staff sanction queue: oldest due date first, with whole-system counts. */
  sanctionQueue(query: SanctionQueueQuery): Promise<StaffSanctionQueueResponse>;
}

