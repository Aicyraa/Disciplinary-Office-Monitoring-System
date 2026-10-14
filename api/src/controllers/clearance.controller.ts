import type { RequestHandler } from 'express';
import type { ClearanceRosterResponse, ClearanceTermsResponse } from '@shared/types.js';
import { sendError, sendFailure, sendNotFound, sendOk } from '../helpers/http.js';
import { parseId, sessionUserId } from '../helpers/params.js';
import { CLEARANCE_PAGE_SIZE, ROSTER_PAGE_SIZE, type ClearanceQueries } from '../repositories/clearance/queries.js';
import { currentTerm, termList } from '../domain/clearance/term.js';
import type { ClearanceFailureCode, ClearanceService } from '../services/clearance.service.js';
import { toStaffClearanceView } from '../views/clearance.views.js';
import { parseStudentId } from '../validators/common.validators.js';
import { parseClearanceListQuery, parseRosterRequest } from '../validators/clearance.validators.js';

export interface ClearanceControllerDeps {
  service: ClearanceService;
  queries: ClearanceQueries;
  /** Injected so tests control "today" (the current term). */
  now: () => Date;
}

const HTTP_STATUS: Record<ClearanceFailureCode, number> = {
  invalid_input: 400,
  not_found: 404,
  student_not_found: 404,
  invalid_status: 409,
  clearance_exists: 409,
  requirement_exists: 409,
};

/**
 * Staff clearance handlers (SPEC 4.4, 7). Items are marked by hand: nothing here reads cases or sanctions to
 * decide anything (the open-case count only feeds the warning hint).
 */
export function createClearanceController({ service, queries, now }: ClearanceControllerDeps) {
  const terms: RequestHandler = async (_request, response) => {
    const current = currentTerm(now());
    const body: ClearanceTermsResponse = { current, terms: termList(current, await queries.termsWithClearances()) };
    sendOk(response, body);
  };

  const roster: RequestHandler = async (request, response) => {
    const input = parseRosterRequest(request.params, request.query);
    if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
    const { term, q, page } = input.value;
    const { rows, total, notCleared } = await queries.roster({ ...term, q, page });
    const body: ClearanceRosterResponse = { term, students: rows, total, page, pageSize: ROSTER_PAGE_SIZE, notCleared };
    sendOk(response, body);
  };

  const list: RequestHandler = async (request, response) => {
    const input = parseClearanceListQuery(request.query);
    if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
    const { rows, total } = await queries.list(input.value);
    sendOk(response, {
      clearances: rows.map(toStaffClearanceView),
      total,
      page: input.value.page,
      pageSize: CLEARANCE_PAGE_SIZE,
    });
  };

  const detail: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    const row = id === null ? null : await queries.get(id);
    if (!row) return sendNotFound(response);
    sendOk(response, { clearance: toStaffClearanceView(row) });
  };

  const setUp: RequestHandler = async (request, response) => {
    const { studentId, academicYear, semester } = request.body ?? {};
    const student = parseStudentId(studentId);
    if (!student.ok) return sendError(response, 400, 'invalid_input', student.message);
    const result = await service.setUp({ employeeId: sessionUserId(request), studentId: student.value, academicYear, semester });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { clearanceId: result.clearanceId }, 201);
  };

  const addRequirement: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendNotFound(response);
    const result = await service.addRequirement({
      employeeId: sessionUserId(request),
      clearanceId: id,
      label: request.body?.label,
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { requirementId: result.requirementId }, 201);
  };

  const removeRequirement: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    const rid = parseId(request.params.rid);
    if (id === null || rid === null) return sendNotFound(response);
    const result = await service.removeRequirement({
      employeeId: sessionUserId(request),
      clearanceId: id,
      requirementId: rid,
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { cleared: result.cleared });
  };

  const markDone: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    const rid = parseId(request.params.rid);
    if (id === null || rid === null) return sendNotFound(response);
    const result = await service.markDone({
      employeeId: sessionUserId(request),
      clearanceId: id,
      requirementId: rid,
      remarks: request.body?.remarks,
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { cleared: result.cleared });
  };

  const reverse: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    const rid = parseId(request.params.rid);
    if (id === null || rid === null) return sendNotFound(response);
    const result = await service.reverse({
      employeeId: sessionUserId(request),
      clearanceId: id,
      requirementId: rid,
      reason: request.body?.reason,
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { ok: true });
  };

  return { terms, roster, list, detail, setUp, addRequirement, removeRequirement, markDone, reverse };
}
