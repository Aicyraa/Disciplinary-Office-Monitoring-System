import type { RequestHandler } from 'express';
import { sendError, sendFailure, sendNotFound, sendOk } from '../helpers/http.js';
import { parseId, sessionUserId } from '../helpers/params.js';
import { manilaToday } from '../views/me.views.js';
import { toStaffAppointmentView } from '../views/appointments.views.js';
import { APPOINTMENT_PAGE_SIZE, type AppointmentQueries } from '../repositories/appointments/queries.js';
import type { AppointmentFailureCode, AppointmentService } from '../services/appointments.service.js';
import { parseAppointmentListQuery, parseAppointmentStudentId } from '../validators/appointments.validators.js';

export interface AppointmentControllerDeps {
  service: AppointmentService;
  queries: AppointmentQueries;
  /** Injected so tests control "today" (Asia/Manila). */
  now: () => Date;
}

const HTTP_STATUS: Record<AppointmentFailureCode, number> = {
  invalid_input: 400,
  invalid_date: 400,
  not_found: 404,
  student_not_found: 404,
  invalid_status: 409,
  appointment_overlap: 409,
};

/**
 * Staff appointment handlers (SPEC 4.5, 7). The window rules live in AppointmentService, so the API is the
 * authority whatever the client sends: the end date is never read from the request, and the student and
 * status cannot be edited.
 */
export function createAppointmentController({ service, queries, now }: AppointmentControllerDeps) {
  const list: RequestHandler = async (request, response) => {
    const input = parseAppointmentListQuery(request.query);
    if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
    const today = manilaToday(now());
    const result = await queries.list({ ...input.value, today });
    sendOk(response, {
      appointments: result.rows.map((row) => toStaffAppointmentView(row, today)),
      total: result.total,
      page: result.page,
      pageSize: APPOINTMENT_PAGE_SIZE,
      counts: result.counts,
      statusCounts: result.statusCounts,
    });
  };

  const detail: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    const row = id === null ? null : await queries.get(id);
    if (!row) return sendNotFound(response);
    sendOk(response, { appointment: toStaffAppointmentView(row, manilaToday(now())) });
  };

  const create: RequestHandler = async (request, response) => {
    const { studentId, startDate, purpose, notes } = request.body ?? {};
    const student = parseAppointmentStudentId(studentId);
    if (!student.ok) return sendError(response, 400, 'invalid_input', student.message);
    const result = await service.create({
      employeeId: sessionUserId(request),
      studentId: student.value,
      startDate,
      purpose,
      notes,
      today: manilaToday(now()),
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { appointmentId: result.appointmentId }, 201);
  };

  const update: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendNotFound(response);
    // Only these three fields can change. The student, the status and the end date are never read from the body.
    const { startDate, purpose, notes } = request.body ?? {};
    const result = await service.update({
      employeeId: sessionUserId(request),
      appointmentId: id,
      startDate,
      purpose,
      notes,
      today: manilaToday(now()),
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { ok: true });
  };

  const complete: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendNotFound(response);
    const result = await service.complete({ employeeId: sessionUserId(request), appointmentId: id });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { ok: true });
  };

  const cancel: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendNotFound(response);
    const result = await service.cancel({
      employeeId: sessionUserId(request),
      appointmentId: id,
      reason: request.body?.reason,
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { ok: true });
  };

  return { list, detail, create, update, complete, cancel };
}
