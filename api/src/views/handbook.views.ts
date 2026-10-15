import type { HandbookEntryView } from '@shared/types.js';
import { displayCode } from '../domain/codes.js';
import type { HandbookEntryRecord } from '../repositories/handbook/repo.js';

export function toHandbookEntryView(record: HandbookEntryRecord): HandbookEntryView {
  return {
    id: record.handbookEntryId,
    code: displayCode('H', record.handbookEntryId),
    violationId: record.violation.violationId,
    violationCode: displayCode('V', record.violation.violationId),
    violation: record.violation.violationType,
    severity: record.violation.severity,
    section: record.handbookSection,
    description: record.violation.description,
    // Ordered here, not in the repository, so every repository yields the same output.
    sanctions: [...record.sanctions]
      .sort((a, b) => a.offenseNumber - b.offenseNumber || a.sanctionId - b.sanctionId)
      .map((sanction) => ({
        offenseNumber: sanction.offenseNumber,
        sanctionId: sanction.sanctionId,
        sanctionCode: displayCode('S', sanction.sanctionId),
        type: sanction.sanctionType,
        description: sanction.description,
      })),
  };
}

/** FEATURE-RULES 3.2: system entries (V068 / H068 "3 minor offense") are hidden from every handbook list. */
export const isVisibleInHandbook = (record: HandbookEntryRecord): boolean => !record.violation.isSystem;
