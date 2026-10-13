import type { ClearanceEventType, ClearanceRecord } from '../../types/clearance.types.js';

export const CLEARANCE_PAGE_SIZE = 10;

export interface ClearanceListFilter {
  status?: 'pending' | 'cleared';
  /** Case-insensitive match on the student's id or name. */
  q?: string;
  page: number;
}

export interface ClearanceRow extends ClearanceRecord {
  studentName: string;
  /** Names of the staff who completed items, keyed by employee id. */
  staffNames: Record<string, string>;
  openCases: number;
  history: Array<{
    eventType: ClearanceEventType;
    requirementLabel: string | null;
    remarks: string | null;
    date: Date;
    by: string;
  }>;
}

export interface ClearanceQueries {
  list(filter: ClearanceListFilter): Promise<{ rows: ClearanceRow[]; total: number }>;
  get(clearanceId: number): Promise<ClearanceRow | null>;
}
