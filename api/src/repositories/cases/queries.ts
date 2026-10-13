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
  /** `status`: stage first (Needs review, Awaiting decision, Sanction in progress, Resolved, Not verified), then `sort`. */
  group?: 'status';
  /** 1-based. */
  page: number;
  /** Answer the page that holds this case instead of `page` (dashboard deep links); ignored when no match holds it. */
  focus?: number;
}

const STAGE_RANK: Record<CaseStatus, number> = { reported: 0, validated: 1, for_sanction: 2, resolved: 3, rejected: 4 };

export interface CaseOrderKey {
  id: number;
  status: CaseStatus;
  /** Epoch milliseconds of the case date. */
  time: number;
}

/** The queue order: stage first when grouped, then case date (newest or oldest first), then id. */
export function compareCases(filter: Pick<CaseListFilter, 'sort' | 'group'>): (a: CaseOrderKey, b: CaseOrderKey) => number {
  return (a, b) => {
    const byStage = filter.group === 'status' ? STAGE_RANK[a.status] - STAGE_RANK[b.status] : 0;
    if (byStage !== 0) return byStage;
    const byDate = a.time - b.time || a.id - b.id;
    return filter.sort === 'newest' ? -byDate : byDate;
  };
}

/** The page to answer: the one holding `focus` when the ordered matches contain it, else the asked page. */
export function pageFor(orderedIds: readonly number[], filter: Pick<CaseListFilter, 'page' | 'focus'>): number {
  if (filter.focus === undefined) return filter.page;
  const index = orderedIds.indexOf(filter.focus);
  return index < 0 ? filter.page : Math.floor(index / CASE_PAGE_SIZE) + 1;
}

/** Read side of the staff case screens. Writes go through the CaseService. */
export interface CaseQueries {
  list(filter: CaseListFilter): Promise<{ rows: StaffCaseRow[]; total: number; page: number; statusCounts: Record<CaseStatus, number> }>;
  /** `today` is the Asia/Manila calendar day, for the derived "late by N days" of each sanction. */
  detail(caseId: number, today: string): Promise<StaffCaseDetail | null>;
  /** The staff sanction queue: oldest due date first, with whole-system counts. */
  sanctionQueue(query: SanctionQueueQuery): Promise<StaffSanctionQueueResponse>;
}

