import { Router, type Response } from 'express';
import type { AuthUser, StaffAppointmentView } from '@shared/types.js';
import { requireStaff } from '../middleware/auth.js';
import { displayCode } from '../domain/codes.js';
import { STUDENT_ID_PATTERN } from '../domain/auth/policy.js';
import { sendError, sendOk } from '../lib/http.js';
import { manilaToday } from '../views/me.views.js';
import { APPOINTMENT_PAGE_SIZE, type AppointmentQueries, type AppointmentRow } from '../repositories/appointments/queries.js';
import type { AppointmentFailure, AppointmentFailureCode, AppointmentService } from '../services/appointments.service.js';
import { parseId } from '../lib/params.js';

export interface AppointmentRouterOptions {
  service: AppointmentService;
  queries: AppointmentQueries;
  /** Injected so tests control "today" (Asia/Manila). */
  now?: () => Date;
}

const HTTP_STATUS: Record<AppointmentFailureCode, number> = {
  invalid_input: 400,
  invalid_date: 400,
  not_found: 404,
  student_not_found: 404,
  invalid_status: 409,
  appointment_overlap: 409,
};

const staffId = (request: { user?: unknown }): string => (request.user as AuthUser).id;

function sendFailure(response: Response, failure: AppointmentFailure): void {
  sendError(response, HTTP_STATUS[failure.code], failure.code, failure.message);
}

export function toStaffAppointmentView(row: AppointmentRow, today: string): StaffAppointmentView {
  const live = row.status === 'scheduled' || row.status === 'rescheduled';
  return {
    id: row.appointmentId,
    code: displayCode('A', row.appointmentId),
    student: { id: row.studentId, name: row.studentName },
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

/**
 * Staff appointment workflow (SPEC 4.5, 7). Every route needs a staff session with a settled password. The
 * window rules live in AppointmentService, so the API is the authority whatever the client sends: the end
 * date is never read from the request, and the student and status cannot be edited.
 */
export function createAppointmentRouter({ service, queries, now = () => new Date() }: AppointmentRouterOptions): Router {
  const router = Router();
  router.use('/appointments', ...requireStaff);

  router.get('/appointments', async (request, response) => {
    const { bucket, q, page } = request.query;
    if (bucket !== undefined && bucket !== 'upcoming' && bucket !== 'history') {
      sendError(response, 400, 'invalid_input', 'bucket must be upcoming or history.');
      return;
    }
    if (page !== undefined && !(typeof page === 'string' && /^[1-9]\d{0,5}$/.test(page))) {
      sendError(response, 400, 'invalid_input', 'page must be a positive whole number.');
      return;
    }
    if (q !== undefined && (typeof q !== 'string' || q.length > 100)) {
      sendError(response, 400, 'invalid_input', 'q must be text up to 100 characters.');
      return;
    }
    const today = manilaToday(now());
    const pageNumber = page === undefined ? 1 : Number(page);
    const { rows, total } = await queries.list({
      bucket: bucket === 'history' ? 'history' : 'upcoming',
      q: typeof q === 'string' ? q : undefined,
      page: pageNumber,
      today,
    });
    sendOk(response, {
      appointments: rows.map((row) => toStaffAppointmentView(row, today)),
      total,
      page: pageNumber,
      pageSize: APPOINTMENT_PAGE_SIZE,
    });
  });

  router.get('/appointments/:id', async (request, response) => {
    const id = parseId(request.params.id);
    const row = id === null ? null : await queries.get(id);
    if (!row) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    sendOk(response, { appointment: toStaffAppointmentView(row, manilaToday(now())) });
  });

  router.post('/appointments', async (request, response) => {
    const { studentId, startDate, purpose, notes } = request.body ?? {};
    if (typeof studentId !== 'string' || !STUDENT_ID_PATTERN.test(studentId.trim())) {
      sendError(response, 400, 'invalid_input', 'Student ID must look like 2025-1234567.');
      return;
    }
    const result = await service.create({
      employeeId: staffId(request),
      studentId: studentId.trim(),
      startDate,
      purpose,
      notes,
      today: manilaToday(now()),
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { appointmentId: result.appointmentId }, 201);
  });

  router.patch('/appointments/:id', async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    // Only these three fields can change. The student, the status and the end date are never read from the body.
    const { startDate, purpose, notes } = request.body ?? {};
    const result = await service.update({
      employeeId: staffId(request),
      appointmentId: id,
      startDate,
      purpose,
      notes,
      today: manilaToday(now()),
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  router.post('/appointments/:id/complete', async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.complete({ employeeId: staffId(request), appointmentId: id });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  router.post('/appointments/:id/cancel', async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.cancel({ employeeId: staffId(request), appointmentId: id, reason: request.body?.reason });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  return router;
}
