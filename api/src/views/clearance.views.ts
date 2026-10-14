import type { StaffClearanceView } from '@shared/types.js';
import { NO_ACTIVE_VIOLATIONS_LABEL } from '../domain/clearance/rules.js';
import type { ClearanceRow } from '../repositories/clearance/queries.js';

export function toStaffClearanceView(row: ClearanceRow): StaffClearanceView {
  return {
    id: row.clearanceId,
    student: { id: row.studentId, name: row.studentName },
    academicYear: row.academicYear,
    semester: row.semester,
    status: row.status,
    openCases: row.openCases,
    items: row.items.map((item) => ({
      requirementId: item.requirementId,
      label: item.label,
      status: item.status,
      remarks: item.remarks,
      dateCompleted: item.dateCompleted?.toISOString() ?? null,
      completedBy: item.completedByEmployeeId ? (row.staffNames[item.completedByEmployeeId] ?? null) : null,
      // A hint for staff, never a block (SPEC 4.4: clearance is manual).
      warning: item.status === 'completed' && item.label === NO_ACTIVE_VIOLATIONS_LABEL && row.openCases > 0,
    })),
    history: row.history.map((entry) => ({
      eventType: entry.eventType,
      requirement: entry.requirementLabel,
      remarks: entry.remarks,
      date: entry.date.toISOString(),
      by: entry.by,
    })),
  };
}
