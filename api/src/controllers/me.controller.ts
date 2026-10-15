import type { RequestHandler } from 'express';
import type { StudentClearanceResponse } from '@shared/types.js';
import { sendError, sendNotFound, sendOk } from '../helpers/http.js';
import { parseId, sessionUserId } from '../helpers/params.js';
import type { StudentViewRepo } from '../repositories/me/repo.js';
import {
  manilaToday,
  sortTerms,
  toAppointmentView,
  toCaseDetailView,
  toCaseView,
  toClearanceView,
  toProfileView,
  toSanctionView,
  toSlipView,
} from '../views/me.views.js';
import { parseOptionalTermQuery, parseRequiredTermQuery } from '../validators/me.validators.js';

/**
 * `/me/*`: a student's own data, read-only (SPEC 7). The student id always comes from the session, never
 * from the URL or body, so a student cannot ask for someone else's rows. A case that is not theirs is a 404.
 */
export function createMeController({ repo, now }: { repo: StudentViewRepo; now: () => Date }) {
  const profile: RequestHandler = async (request, response) => {
    const found = await repo.getProfile(sessionUserId(request));
    if (!found) return sendNotFound(response);
    sendOk(response, { profile: toProfileView(found) });
  };

  const cases: RequestHandler = async (request, response) => {
    const rows = await repo.listCases(sessionUserId(request));
    sendOk(response, { cases: rows.map(toCaseView) });
  };

  const caseDetail: RequestHandler = async (request, response) => {
    const caseId = parseId(String(request.params.id));
    const owner = sessionUserId(request);
    const record = caseId === null ? null : await repo.getCase(owner, caseId);
    if (!record || caseId === null) return sendNotFound(response);
    const sanctions = await repo.listSanctions(owner, { caseId });
    sendOk(response, { case: toCaseDetailView(record, sanctions, manilaToday(now())) });
  };

  const sanctions: RequestHandler = async (request, response) => {
    const rows = await repo.listSanctions(sessionUserId(request));
    const today = manilaToday(now());
    sendOk(response, { sanctions: rows.map((sanction) => toSanctionView(sanction, today)) });
  };

  const appointments: RequestHandler = async (request, response) => {
    const today = manilaToday(now());
    const rows = await repo.listAppointments(sessionUserId(request));
    sendOk(response, { appointments: rows.map((record) => toAppointmentView(record, today)) });
  };

  const clearance: RequestHandler = async (request, response) => {
    const owner = sessionUserId(request);
    const term = parseOptionalTermQuery(request.query);
    if (!term.ok) return sendError(response, 400, 'invalid_input', term.message);
    const terms = sortTerms(await repo.listClearanceTerms(owner));
    let { year, semester } = term.value;
    if (year === undefined && terms.length > 0) {
      year = terms[0].academicYear;
      semester = terms[0].semester;
    }
    const record = year === undefined || semester === undefined ? null : await repo.getClearance(owner, year, semester);
    const body: StudentClearanceResponse = { terms, clearance: record ? toClearanceView(record) : null };
    sendOk(response, body);
  };

  /** The slip is data for a print-styled page. The API is the authority: nothing is returned until the term is cleared. */
  const clearanceSlip: RequestHandler = async (request, response) => {
    const owner = sessionUserId(request);
    const term = parseRequiredTermQuery(request.query);
    if (!term.ok) return sendError(response, 400, 'invalid_input', term.message);
    const [record, profileRecord] = await Promise.all([
      repo.getClearance(owner, term.value.year, term.value.semester),
      repo.getProfile(owner),
    ]);
    if (!record || !profileRecord) return sendError(response, 404, 'not_found', 'No clearance for that term.');
    if (record.status !== 'cleared') {
      return sendError(response, 409, 'not_cleared', 'The clearance slip is available once every requirement is completed.');
    }
    response.set('Cache-Control', 'no-store');
    sendOk(response, { slip: toSlipView(profileRecord, record) });
  };

  return { profile, cases, caseDetail, sanctions, appointments, clearance, clearanceSlip };
}
