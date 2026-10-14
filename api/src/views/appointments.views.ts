import type { StaffAppointmentView } from '@shared/types.js';
import { displayCode } from '../domain/codes.js';
import type { AppointmentRow } from '../repositories/appointments/queries.js';

export function toStaffAppointmentView(row: AppointmentRow, today: string): StaffAppointmentView {
  const live = row.status === 'scheduled' || row.status === 'rescheduled';
  return {
    id: row.appointmentId,
    code: displayCode('A', row.appointmentId),
    student: { id: row.studentId, name: row.studentName, program: row.studentProgram, yearLevel: row.studentYearLevel },
    startDate: row.startDate,
    endDate: row.endDate,
    purpose: row.purpose,
    notes: row.notes,
    status: row.status,
    cancelReason: row.cancelReason,
    bucket: live && row.endDate >= today ? 'upcoming' : 'history',
    assignedBy: row.assignedByName,
    dateCreated: row.dateCreated.toISOString(),
    history: row.history.map((entry) => ({
      eventType: entry.eventType,
      remarks: entry.remarks,
      date: entry.date.toISOString(),
      by: entry.by,
    })),
  };
}
