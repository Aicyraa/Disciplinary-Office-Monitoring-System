import { Router, type Response } from 'express';
import type { AuthUser, CaseStatus, Severity } from '@shared/types.js';
import { requireStaff } from '../middleware/auth.js';
import { sendError, sendOk } from '../lib/http.js';
import { STUDENT_ID_PATTERN } from '../domain/auth/policy.js';
import { manilaToday } from '../views/me.views.js';
import { CASE_PAGE_SIZE, type CaseQueries } from '../repositories/cases/queries.js';
import type { CaseFailure, CaseFailureCode, CaseService } from '../services/cases.service.js';
import { parseId } from '../lib/params.js';

export interface CaseRouterOptions {
  service: CaseService;
  queries: CaseQueries;
  /** Injected so tests control "today" (Asia/Manila). */
  now?: () => Date;
}

const STATUSES: readonly CaseStatus[] = ['reported', 'validated', 'for_sanction', 'resolved', 'rejected'];
const SEVERITIES: readonly Severity[] = ['Minor', 'Major'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const HTTP_STATUS: Record<CaseFailureCode, number> = {
  invalid_input: 400,
  not_found: 404,
  student_not_found: 404,
  violation_not_found: 404,
  violation_not_allowed: 409,
  already_decided: 409,
  student_not_matched: 409,
  student_already_linked: 409,
  invalid_status: 409,
  sanctions_incomplete: 409,
};

const staffId = (request: { user?: unknown }): string => (request.user as AuthUser).id;

function sendFailure(response: Response, failure: CaseFailure): void {
  sendError(response, HTTP_STATUS[failure.code], failure.code, failure.message);
}

/**
 * Staff case workflow (SPEC 7). Every route needs a staff session with a settled password; the rules
 * themselves live in CaseService so they hold no matter which client calls.
 */
export function createCaseRouter({ service, queries, now = () => new Date() }: CaseRouterOptions): Router {
  const router = Router();
  router.use(['/cases', '/submissions', '/case-sanctions'], ...requireStaff);

  router.get('/cases', async (request, response) => {
    const { status, class: severity, q, sort, page, group, focus } = request.query;
    if (group !== undefined && group !== 'status') {
      sendError(response, 400, 'invalid_input', 'group must be status.');
      return;
    }
    if (focus !== undefined && !(typeof focus === 'string' && /^[1-9]\d{0,9}$/.test(focus))) {
      sendError(response, 400, 'invalid_input', 'focus must be a case id.');
      return;
    }
    if (status !== undefined && !STATUSES.includes(status as CaseStatus)) {
      sendError(response, 400, 'invalid_input', 'Unknown status.');
      return;
    }
    if (severity !== undefined && !SEVERITIES.includes(severity as Severity)) {
      sendError(response, 400, 'invalid_input', 'class must be Minor or Major.');
      return;
    }
    if (sort !== undefined && sort !== 'newest' && sort !== 'oldest') {
      sendError(response, 400, 'invalid_input', 'sort must be newest or oldest.');
      return;
    }
    if (page !== undefined && !(typeof page === 'string' && /^[1-9]\d{0,5}$/.test(page))) {
      sendError(response, 400, 'invalid_input', 'page must be a positive whole number.');
      return;
    }
    const text = typeof q === 'string' ? q.slice(0, 100) : undefined;
    const pageNumber = page === undefined ? 1 : Number(page);
    const { rows, total, statusCounts, page: answered } = await queries.list({
      status: status as CaseStatus | undefined,
      severity: severity as Severity | undefined,
      q: text,
      sort: sort === 'oldest' ? 'oldest' : 'newest',
      group: group === 'status' ? 'status' : undefined,
      page: pageNumber,
      focus: focus === undefined ? undefined : Number(focus),
    });
    sendOk(response, { cases: rows, total, statusCounts, page: answered, pageSize: CASE_PAGE_SIZE });
  });

  router.get('/cases/:id', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    const detail = caseId === null ? null : await queries.detail(caseId, manilaToday(now()));
    if (!detail) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    sendOk(response, { case: detail });
  });

  router.get('/case-sanctions', async (request, response) => {
    const rawFilter = request.query.filter;
    const rawPage = request.query.page;
    const filter = rawFilter === undefined ? 'active' : rawFilter;
    if (filter !== 'active' && filter !== 'pending_verification' && filter !== 'overdue') {
      sendError(response, 400, 'invalid_input', 'filter must be active, pending_verification or overdue.');
      return;
    }
    if (rawPage !== undefined && (typeof rawPage !== 'string' || !/^[1-9]\d{0,5}$/.test(rawPage))) {
      sendError(response, 400, 'invalid_input', 'page must be a positive number.');
      return;
    }
    const body = await queries.sanctionQueue({
      filter,
      page: rawPage === undefined ? 1 : Number(rawPage),
      today: manilaToday(now()),
    });
    sendOk(response, body);
  });

  router.post('/cases', async (request, response) => {
    const studentId = typeof request.body?.studentId === 'string' ? request.body.studentId.trim() : '';
    const handbookEntryId = request.body?.handbookEntryId;
    if (!STUDENT_ID_PATTERN.test(studentId) || !Number.isInteger(handbookEntryId) || handbookEntryId < 1) {
      sendError(response, 400, 'invalid_input', 'studentId (YYYY-NNNNNNN) and handbookEntryId are required.');
      return;
    }
    const result = await service.recordViolation({
      employeeId: staffId(request),
      studentId,
      handbookEntryId,
      remarks: request.body?.remarks,
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { caseId: result.caseId, conversions: result.conversions }, 201);
  });

  const withRef = (request: { params: Record<string, unknown> }, response: Response): string | null => {
    const ref = String(request.params.ref);
    if (!UUID.test(ref)) {
      sendError(response, 404, 'not_found', 'Not found.');
      return null;
    }
    return ref.toLowerCase();
  };

  router.get('/submissions/:ref/escalation-preview', async (request, response) => {
    const ref = withRef(request, response);
    if (ref === null) return;
    const result = await service.previewEscalation(ref);
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { conversions: result.conversions });
  });

  router.post('/submissions/:ref/validate', async (request, response) => {
    const ref = withRef(request, response);
    if (ref === null) return;
    const result = await service.validateSubmission({ employeeId: staffId(request), submissionRef: ref });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { caseIds: result.caseIds, conversions: result.conversions });
  });

  router.post('/submissions/:ref/reject', async (request, response) => {
    const ref = withRef(request, response);
    if (ref === null) return;
    const result = await service.rejectSubmission({
      employeeId: staffId(request),
      submissionRef: ref,
      reason: request.body?.reason,
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { caseIds: result.caseIds });
  });

  router.patch('/cases/:id/student', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    const studentId = typeof request.body?.studentId === 'string' ? request.body.studentId.trim() : '';
    if (caseId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    if (!STUDENT_ID_PATTERN.test(studentId)) {
      sendError(response, 400, 'invalid_input', 'studentId must look like YYYY-NNNNNNN.');
      return;
    }
    const result = await service.linkStudent({ employeeId: staffId(request), caseId, studentId });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { caseIds: result.caseIds });
  });

  router.post('/cases/:id/resolve', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    if (caseId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.resolveCase({ employeeId: staffId(request), caseId });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  router.post('/cases/:id/resolve-without-sanction', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    if (caseId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.resolveWithoutSanction({
      employeeId: staffId(request),
      caseId,
      reason: request.body?.reason,
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  router.post('/cases/:id/remarks', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    if (caseId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.addRemark({ employeeId: staffId(request), caseId, remarks: request.body?.remarks });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true }, 201);
  });

  return router;
}
