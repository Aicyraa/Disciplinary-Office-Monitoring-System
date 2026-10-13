import { Router } from 'express';
import type { AuthUser, StudentClearanceResponse } from '@shared/types.js';
import { requireStudent } from '../middleware/auth.js';
import { sendError, sendOk } from '../lib/http.js';
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

export interface MeRouterOptions {
  repo: StudentViewRepo;
  now?: () => Date;
}

const parseId = (value: string): number | null => (/^\d{1,9}$/.test(value) ? Number(value) : null);

/**
 * `/me/*`: a student's own data, read-only (SPEC 7). The student id always comes from the session, never
 * from the URL or body, so a student cannot ask for someone else's rows. A case that is not theirs is a 404.
 */
export function createMeRouter({ repo, now = () => new Date() }: MeRouterOptions): Router {
  const router = Router();
  router.use('/me', ...requireStudent);

  const studentId = (request: { user?: unknown }): string => (request.user as AuthUser).id;

  router.get('/me/profile', async (request, response) => {
    const profile = await repo.getProfile(studentId(request));
    if (!profile) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    sendOk(response, { profile: toProfileView(profile) });
  });

  router.get('/me/cases', async (request, response) => {
    const cases = await repo.listCases(studentId(request));
    sendOk(response, { cases: cases.map(toCaseView) });
  });

  router.get('/me/cases/:id', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    const owner = studentId(request);
    const record = caseId === null ? null : await repo.getCase(owner, caseId);
    if (!record || caseId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const sanctions = await repo.listSanctions(owner, { caseId });
    sendOk(response, { case: toCaseDetailView(record, sanctions, manilaToday(now())) });
  });

  router.get('/me/sanctions', async (request, response) => {
    const sanctions = await repo.listSanctions(studentId(request));
    const today = manilaToday(now());
    sendOk(response, { sanctions: sanctions.map((sanction) => toSanctionView(sanction, today)) });
  });

  router.get('/me/appointments', async (request, response) => {
    const today = manilaToday(now());
    const appointments = await repo.listAppointments(studentId(request));
    sendOk(response, { appointments: appointments.map((record) => toAppointmentView(record, today)) });
  });

  router.get('/me/clearance', async (request, response) => {
    const owner = studentId(request);
    const { academic_year: yearParam, semester: semesterParam } = request.query;
    const terms = sortTerms(await repo.listClearanceTerms(owner));

    let year: number | undefined;
    let semester: number | undefined;
    if (yearParam !== undefined || semesterParam !== undefined) {
      year = typeof yearParam === 'string' && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined;
      semester = typeof semesterParam === 'string' && /^[1-3]$/.test(semesterParam) ? Number(semesterParam) : undefined;
      if (year === undefined || semester === undefined) {
        sendError(response, 400, 'invalid_input', 'academic_year (YYYY) and semester (1-3) are required together.');
        return;
      }
    } else if (terms.length > 0) {
      year = terms[0].academicYear;
      semester = terms[0].semester;
    }

    const record = year === undefined || semester === undefined ? null : await repo.getClearance(owner, year, semester);
    const body: StudentClearanceResponse = { terms, clearance: record ? toClearanceView(record) : null };
    sendOk(response, body);
  });

  // The slip is data for a print-styled page. The API is the authority: nothing is returned until the term is cleared.
  router.get('/me/clearance/slip', async (request, response) => {
    const owner = studentId(request);
    const { academic_year: yearParam, semester: semesterParam } = request.query;
    const year = typeof yearParam === 'string' && /^\d{4}$/.test(yearParam) ? Number(yearParam) : undefined;
    const semester = typeof semesterParam === 'string' && /^[1-3]$/.test(semesterParam) ? Number(semesterParam) : undefined;
    if (year === undefined || semester === undefined) {
      sendError(response, 400, 'invalid_input', 'academic_year (YYYY) and semester (1-3) are required.');
      return;
    }
    const [record, profile] = await Promise.all([repo.getClearance(owner, year, semester), repo.getProfile(owner)]);
    if (!record || !profile) {
      sendError(response, 404, 'not_found', 'No clearance for that term.');
      return;
    }
    if (record.status !== 'cleared') {
      sendError(response, 409, 'not_cleared', 'The clearance slip is available once every requirement is completed.');
      return;
    }
    response.set('Cache-Control', 'no-store');
    sendOk(response, { slip: toSlipView(profile, record) });
  });

  return router;
}
