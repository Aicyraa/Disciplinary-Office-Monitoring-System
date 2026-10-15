import type { Severity } from '@shared/types.js';

export interface HandbookEntryRecord {
  handbookEntryId: number;
  handbookSection: string;
  violation: {
    violationId: number;
    violationType: string;
    severity: Severity;
    description: string;
    isSystem: boolean;
  };
  sanctions: Array<{
    offenseNumber: number;
    sanctionId: number;
    sanctionType: string;
    description: string;
  }>;
}

export interface HandbookRepo {
  listEntries(): Promise<HandbookEntryRecord[]>;
  getEntry(handbookEntryId: number): Promise<HandbookEntryRecord | null>;
  /** How many cases use each handbook entry as their current entry (entries with none are absent). */
  caseCounts(): Promise<Map<number, number>>;
}
