import type { CaseStatus, Severity, StaffCaseDetail, StaffCaseRow } from '../../../shared/types.js';

export const CASE_PAGE_SIZE = 6;

export interface CaseListFilter {
  status?: CaseStatus;
  severity?: Severity;
  /** Free text: student id or name, violation, or a case code such as C005. */
  q?: string;
  sort: 'newest' | 'oldest';
  /** 1-based. */
  page: number;
}

/** Read side of the staff case screens. Writes go through the CaseService. */
export interface CaseQueries {
  list(filter: CaseListFilter): Promise<{ rows: StaffCaseRow[]; total: number }>;
  /** `today` is the Asia/Manila calendar day, for the derived "late by N days" of each sanction. */
  detail(caseId: number, today: string): Promise<StaffCaseDetail | null>;
}

/** "C005", "c5" or "5" -> 5; anything else -> null. */
export function parseCaseCode(text: string): number | null {
  const match = /^c?0*(\d{1,9})$/i.exec(text.trim());
  return match ? Number(match[1]) : null;
}
