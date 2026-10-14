import type { Severity } from '@shared/types.js';

export interface AdminEntryRecord {
  handbookEntryId: number;
  violationId: number;
  violationType: string;
  severity: Severity;
  description: string;
  isSystem: boolean;
  section: string;
  sanctions: Array<{ offenseNumber: number; sanctionId: number }>;
}

export interface SanctionChoice {
  offenseNumber: number;
  sanctionId: number;
}

/** Everything the handbook admin workflow reads and writes, scoped to one database transaction. */
export interface HandbookAdminTx {
  getEntry(handbookEntryId: number): Promise<AdminEntryRecord | null>;
  /** The violation with exactly this name (case-insensitive), or null. */
  findViolationByName(name: string): Promise<{ violationId: number } | null>;
  /** How many of these sanction ids exist. */
  countSanctions(sanctionIds: number[]): Promise<number>;
  /** Cases whose current handbook entry is this one. */
  countCases(handbookEntryId: number): Promise<number>;
  insertViolation(input: { violationType: string; severity: Severity; description: string }): Promise<number>;
  insertEntry(input: { violationId: number; section: string }): Promise<number>;
  updateViolation(violationId: number, patch: { violationType?: string; severity?: Severity; description?: string }): Promise<void>;
  updateEntry(handbookEntryId: number, patch: { section?: string }): Promise<void>;
  /** Replaces the whole set of allowed sanctions (one row per offense number and sanction). */
  replaceSanctions(handbookEntryId: number, sanctions: SanctionChoice[]): Promise<void>;
}

export interface HandbookAdminStore {
  /** Runs `work` atomically: every write commits together or none do. */
  transaction<T>(work: (tx: HandbookAdminTx) => Promise<T>): Promise<T>;
}
