import { Router, type Response } from 'express';
import type { AuthUser, CaseStatus, Severity } from '../../../shared/types.js';
import { requireStaff } from '../auth/guards.js';
import { STUDENT_ID_PATTERN } from '../auth/policy.js';
import { manilaToday } from '../me/views.js';
import { CASE_PAGE_SIZE, type CaseQueries } from './queries.js';
import type { CaseFailure, CaseFailureCode, CaseService } from './service.js';

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

const parseId = (value: string): number | null => (/^\d{1,9}$/.test(value) ? Number(value) : null);
const staffId = (request: { user?: unknown }): string => (request.user as AuthUser).id;

function sendFailure(response: Response, failure: CaseFailure): void {
  response.status(HTTP_STATUS[failure.code]).json({ error: failure.code, message: failure.message });
}

/**
 * Staff case workflow (SPEC 7). Every route needs a staff session with a settled password; the rules
 * themselves live in CaseService so they hold no matter which client calls.
 */
export function createCaseRouter({ service, queries, now = () => new Date() }: CaseRouterOptions): Router {
  const router = Router();
  router.use(['/cases', '/submissions'], ...requireStaff);

  router.get('/cases', async (request, response) => {
    const { status, class: severity, q, sort, page } = request.query;
    if (status !== undefined && !STATUSES.includes(status as CaseStatus)) {
      response.status(400).json({ error: 'invalid_input', message: 'Unknown status.' });
      return;
    }
    if (severity !== undefined && !SEVERITIES.includes(severity as Severity)) {
      response.status(400).json({ error: 'invalid_input', message: 'class must be Minor or Major.' });
      return;
    }
    if (sort !== undefined && sort !== 'newest' && sort !== 'oldest') {
      response.status(400).json({ error: 'invalid_input', message: 'sort must be newest or oldest.' });
      return;
    }
    if (page !== undefined && !(typeof page === 'string' && /^[1-9]\d{0,5}$/.test(page))) {
      response.status(400).json({ error: 'invalid_input', message: 'page must be a positive whole number.' });
      return;
    }
    const text = typeof q === 'string' ? q.slice(0, 100) : undefined;
    const pageNumber = page === undefined ? 1 : Number(page);
    const { rows, total } = await queries.list({
      status: status as CaseStatus | undefined,
      severity: severity as Severity | undefined,
      q: text,
      sort: sort === 'oldest' ? 'oldest' : 'newest',
      page: pageNumber,
    });
    response.status(200).json({ cases: rows, total, page: pageNumber, pageSize: CASE_PAGE_SIZE });
  });

  router.get('/cases/:id', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    const detail = caseId === null ? null : await queries.detail(caseId, manilaToday(now()));
    if (!detail) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    response.status(200).json({ case: detail });
  });

  router.post('/cases', async (request, response) => {
    const studentId = typeof request.body?.studentId === 'string' ? request.body.studentId.trim() : '';
    const handbookEntryId = request.body?.handbookEntryId;
    if (!STUDENT_ID_PATTERN.test(studentId) || !Number.isInteger(handbookEntryId) || handbookEntryId < 1) {
      response.status(400).json({ error: 'invalid_input', message: 'studentId (YYYY-NNNNNNN) and handbookEntryId are required.' });
      return;
    }
    const result = await service.recordViolation({ employeeId: staffId(request), studentId, handbookEntryId });
    if (!result.ok) return sendFailure(response, result);
    response.status(201).json({ caseId: result.caseId, conversions: result.conversions });
  });

  const withRef = (request: { params: Record<string, unknown> }, response: Response): string | null => {
    const ref = String(request.params.ref);
    if (!UUID.test(ref)) {
      response.status(404).json({ error: 'not_found' });
      return null;
    }
    return ref.toLowerCase();
  };

  router.get('/submissions/:ref/escalation-preview', async (request, response) => {
    const ref = withRef(request, response);
    if (ref === null) return;
    const result = await service.previewEscalation(ref);
    if (!result.ok) return sendFailure(response, result);
    response.status(200).json({ conversions: result.conversions });
  });

  router.post('/submissions/:ref/validate', async (request, response) => {
    const ref = withRef(request, response);
    if (ref === null) return;
    const result = await service.validateSubmission({ employeeId: staffId(request), submissionRef: ref });
    if (!result.ok) return sendFailure(response, result);
    response.status(200).json({ caseIds: result.caseIds, conversions: result.conversions });
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
    response.status(200).json({ caseIds: result.caseIds });
  });

  router.patch('/cases/:id/student', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    const studentId = typeof request.body?.studentId === 'string' ? request.body.studentId.trim() : '';
    if (caseId === null) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    if (!STUDENT_ID_PATTERN.test(studentId)) {
      response.status(400).json({ error: 'invalid_input', message: 'studentId must look like YYYY-NNNNNNN.' });
      return;
    }
    const result = await service.linkStudent({ employeeId: staffId(request), caseId, studentId });
    if (!result.ok) return sendFailure(response, result);
    response.status(200).json({ caseIds: result.caseIds });
  });

  router.post('/cases/:id/resolve', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    if (caseId === null) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    const result = await service.resolveCase({ employeeId: staffId(request), caseId });
    if (!result.ok) return sendFailure(response, result);
    response.status(200).json({ ok: true });
  });

  router.post('/cases/:id/resolve-without-sanction', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    if (caseId === null) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    const result = await service.resolveWithoutSanction({
      employeeId: staffId(request),
      caseId,
      reason: request.body?.reason,
    });
    if (!result.ok) return sendFailure(response, result);
    response.status(200).json({ ok: true });
  });

  router.post('/cases/:id/remarks', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    if (caseId === null) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    const result = await service.addRemark({ employeeId: staffId(request), caseId, remarks: request.body?.remarks });
    if (!result.ok) return sendFailure(response, result);
    response.status(201).json({ ok: true });
  });

  return router;
}
