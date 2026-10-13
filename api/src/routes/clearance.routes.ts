import { Router, type Response } from 'express';
import type { AuthUser, StaffClearanceView } from '@shared/types.js';
import { requireStaff } from '../middleware/auth.js';
import { STUDENT_ID_PATTERN } from '../domain/auth/policy.js';
import { sendError, sendOk } from '../lib/http.js';
import { CLEARANCE_PAGE_SIZE, type ClearanceQueries, type ClearanceRow } from '../repositories/clearance/queries.js';
import { NO_ACTIVE_VIOLATIONS_LABEL } from '../domain/clearance/rules.js';
import type { ClearanceFailure, ClearanceFailureCode, ClearanceService } from '../services/clearance.service.js';
import { parseId } from '../lib/params.js';

export interface ClearanceRouterOptions {
  service: ClearanceService;
  queries: ClearanceQueries;
}

const HTTP_STATUS: Record<ClearanceFailureCode, number> = {
  invalid_input: 400,
  not_found: 404,
  student_not_found: 404,
  invalid_status: 409,
  clearance_exists: 409,
  requirement_exists: 409,
};

const staffId = (request: { user?: unknown }): string => (request.user as AuthUser).id;

function sendFailure(response: Response, failure: ClearanceFailure): void {
  sendError(response, HTTP_STATUS[failure.code], failure.code, failure.message);
}

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

/**
 * Staff clearance workflow (SPEC 4.4, 7). Every route needs a staff session with a settled password. Items are
 * marked by hand: nothing here reads cases or sanctions to decide anything (the open-case count only feeds the
 * warning hint).
 */
export function createClearanceRouter({ service, queries }: ClearanceRouterOptions): Router {
  const router = Router();
  router.use('/clearances', ...requireStaff);

  router.get('/clearances', async (request, response) => {
    const { status, q, page } = request.query;
    if (status !== undefined && status !== 'pending' && status !== 'cleared') {
      sendError(response, 400, 'invalid_input', 'status must be pending or cleared.');
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
    const pageNumber = page === undefined ? 1 : Number(page);
    const { rows, total } = await queries.list({
      status: status as 'pending' | 'cleared' | undefined,
      q: typeof q === 'string' ? q : undefined,
      page: pageNumber,
    });
    sendOk(response, {
      clearances: rows.map(toStaffClearanceView),
      total,
      page: pageNumber,
      pageSize: CLEARANCE_PAGE_SIZE,
    });
  });

  router.get('/clearances/:id', async (request, response) => {
    const id = parseId(request.params.id);
    const row = id === null ? null : await queries.get(id);
    if (!row) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    sendOk(response, { clearance: toStaffClearanceView(row) });
  });

  router.post('/clearances', async (request, response) => {
    const { studentId, academicYear, semester } = request.body ?? {};
    if (typeof studentId !== 'string' || !STUDENT_ID_PATTERN.test(studentId.trim())) {
      sendError(response, 400, 'invalid_input', 'Student ID must look like 2025-1234567.');
      return;
    }
    const result = await service.setUp({ employeeId: staffId(request), studentId: studentId.trim(), academicYear, semester });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { clearanceId: result.clearanceId }, 201);
  });

  router.post('/clearances/:id/requirements', async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.addRequirement({ employeeId: staffId(request), clearanceId: id, label: request.body?.label });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { requirementId: result.requirementId }, 201);
  });

  router.delete('/clearances/:id/requirements/:rid', async (request, response) => {
    const id = parseId(request.params.id);
    const rid = parseId(request.params.rid);
    if (id === null || rid === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.removeRequirement({ employeeId: staffId(request), clearanceId: id, requirementId: rid });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { cleared: result.cleared });
  });

  router.post('/clearances/:id/requirements/:rid/complete', async (request, response) => {
    const id = parseId(request.params.id);
    const rid = parseId(request.params.rid);
    if (id === null || rid === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.markDone({
      employeeId: staffId(request),
      clearanceId: id,
      requirementId: rid,
      remarks: request.body?.remarks,
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { cleared: result.cleared });
  });

  router.post('/clearances/:id/requirements/:rid/reverse', async (request, response) => {
    const id = parseId(request.params.id);
    const rid = parseId(request.params.rid);
    if (id === null || rid === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.reverse({
      employeeId: staffId(request),
      clearanceId: id,
      requirementId: rid,
      reason: request.body?.reason,
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  return router;
}
