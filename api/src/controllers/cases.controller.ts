import type { Request, RequestHandler, Response } from 'express';
import type { AuthUser } from '@shared/types.js';
import { sendError, sendOk } from '../helpers/http.js';
import { parseId } from '../helpers/params.js';
import { manilaToday } from '../views/me.views.js';
import { CASE_PAGE_SIZE, type CaseQueries } from '../repositories/cases/queries.js';
import type { CaseFailure, CaseFailureCode, CaseService } from '../services/cases.service.js';
import {
  parseCaseListQuery,
  parseLinkStudentBody,
  parseRecordViolationBody,
  parseSanctionQueueQuery,
  parseSubmissionRef,
} from '../validators/cases.validators.js';

export interface CaseControllerDeps {
  service: CaseService;
  queries: CaseQueries;
  /** Injected so tests control "today" (Asia/Manila). */
  now: () => Date;
}

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

const staffId = (request: Request): string => (request.user as AuthUser).id;
const notFound = (response: Response): void => sendError(response, 404, 'not_found', 'Not found.');

function sendFailure(response: Response, failure: CaseFailure): void {
  sendError(response, HTTP_STATUS[failure.code], failure.code, failure.message);
}

/** Staff case workflow handlers (SPEC 7): parse the request, call the service or queries, send the envelope. */
export function createCaseController({ service, queries, now }: CaseControllerDeps) {
  const list: RequestHandler = async (request, response) => {
    const input = parseCaseListQuery(request.query);
    if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
    const { rows, total, statusCounts, page } = await queries.list(input.value);
    sendOk(response, { cases: rows, total, statusCounts, page, pageSize: CASE_PAGE_SIZE });
  };

  const detail: RequestHandler = async (request, response) => {
    const caseId = parseId(String(request.params.id));
    const found = caseId === null ? null : await queries.detail(caseId, manilaToday(now()));
    if (!found) return notFound(response);
    sendOk(response, { case: found });
  };

  const sanctionQueue: RequestHandler = async (request, response) => {
    const input = parseSanctionQueueQuery(request.query);
    if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
    sendOk(response, await queries.sanctionQueue({ ...input.value, today: manilaToday(now()) }));
  };

  const record: RequestHandler = async (request, response) => {
    const input = parseRecordViolationBody(request.body);
    if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
    const result = await service.recordViolation({
      employeeId: staffId(request),
      ...input.value,
      remarks: request.body?.remarks,
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { caseId: result.caseId, conversions: result.conversions }, 201);
  };

  const previewEscalation: RequestHandler = async (request, response) => {
    const ref = parseSubmissionRef(request.params.ref);
    if (ref === null) return notFound(response);
    const result = await service.previewEscalation(ref);
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { conversions: result.conversions });
  };

  const validateSubmission: RequestHandler = async (request, response) => {
    const ref = parseSubmissionRef(request.params.ref);
    if (ref === null) return notFound(response);
    const result = await service.validateSubmission({ employeeId: staffId(request), submissionRef: ref });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { caseIds: result.caseIds, conversions: result.conversions });
  };

  const rejectSubmission: RequestHandler = async (request, response) => {
    const ref = parseSubmissionRef(request.params.ref);
    if (ref === null) return notFound(response);
    const result = await service.rejectSubmission({
      employeeId: staffId(request),
      submissionRef: ref,
      reason: request.body?.reason,
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { caseIds: result.caseIds });
  };

  const linkStudent: RequestHandler = async (request, response) => {
    const caseId = parseId(String(request.params.id));
    if (caseId === null) return notFound(response);
    const input = parseLinkStudentBody(request.body);
    if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
    const result = await service.linkStudent({ employeeId: staffId(request), caseId, studentId: input.value.studentId });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { caseIds: result.caseIds });
  };

  const resolve: RequestHandler = async (request, response) => {
    const caseId = parseId(String(request.params.id));
    if (caseId === null) return notFound(response);
    const result = await service.resolveCase({ employeeId: staffId(request), caseId });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  };

  const resolveWithoutSanction: RequestHandler = async (request, response) => {
    const caseId = parseId(String(request.params.id));
    if (caseId === null) return notFound(response);
    const result = await service.resolveWithoutSanction({
      employeeId: staffId(request),
      caseId,
      reason: request.body?.reason,
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  };

  const addRemark: RequestHandler = async (request, response) => {
    const caseId = parseId(String(request.params.id));
    if (caseId === null) return notFound(response);
    const result = await service.addRemark({ employeeId: staffId(request), caseId, remarks: request.body?.remarks });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true }, 201);
  };

  return {
    list,
    detail,
    sanctionQueue,
    record,
    previewEscalation,
    validateSubmission,
    rejectSubmission,
    linkStudent,
    resolve,
    resolveWithoutSanction,
    addRemark,
  };
}
