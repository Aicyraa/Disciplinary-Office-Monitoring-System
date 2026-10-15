import type { ClearanceRosterRow } from '@shared/types.js';
import type { ClearanceEventType, ClearanceRecord } from './types.js';

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

export const ROSTER_PAGE_SIZE = 20;

export interface RosterFilter {
  academicYear: number;
  semester: number;
  q?: string;
  page: number;
}

export interface ClearanceQueries {
  list(filter: ClearanceListFilter): Promise<{ rows: ClearanceRow[]; total: number }>;
  get(clearanceId: number): Promise<ClearanceRow | null>;
  /** Every active student with their clearance for one term, or none (UI-POLISH-SPEC D3). Sorted by name. */
  roster(filter: RosterFilter): Promise<{ rows: ClearanceRosterRow[]; total: number; notCleared: number }>;
  /** The distinct terms that have at least one clearance. */
  termsWithClearances(): Promise<Array<{ academicYear: number; semester: number }>>;
}
