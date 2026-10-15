import type { StaffSanctionView } from '@shared/types.js';
import type { CaseSanctionRecord } from '../repositories/cases/types.js';
import { displayCode } from '../domain/codes.js';
import { manilaToday } from './me.views.js';
import { lateByDays } from '../domain/sanctions/rules.js';

/** Staff view of one sanction: which proof files exist and whether each was opened (verify needs all). */
export function toStaffSanctionView(record: CaseSanctionRecord, today: string): StaffSanctionView {
  return {
    id: record.caseSanctionId,
    sanctionCode: displayCode('S', record.sanctionId),
    type: record.sanctionType,
    status: record.status,
    dueDate: record.dueDate,
    dateSubmitted: record.dateSubmitted ? record.dateSubmitted.toISOString() : null,
    dateCompleted: record.dateCompleted ? record.dateCompleted.toISOString() : null,
    staffNote: record.staffNote,
    complianceNote: record.complianceNote,
    lateByDays: lateByDays({
      dueDate: record.dueDate,
      status: record.status,
      today,
      completedOn: record.dateCompleted ? manilaToday(record.dateCompleted) : null,
    }),
    files: record.files.map((file) => ({
      id: file.caseSanctionFileId,
      name: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      dateUploaded: file.dateUploaded.toISOString(),
      viewed: file.dateViewed !== null,
    })),
  };
}
