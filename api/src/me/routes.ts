import { Router } from 'express';
import type { AuthUser, StudentClearanceResponse } from '../../../shared/types.js';
import { requireStudent } from '../auth/guards.js';
import type { StudentViewRepo } from './repo.js';
import {
  manilaToday,
  sortTerms,
  toAppointmentView,
  toCaseDetailView,
  toCaseView,
  toClearanceView,
  toSanctionView,
} from './views.js';

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

  router.get('/me/cases', async (request, response) => {
    const cases = await repo.listCases(studentId(request));
    response.status(200).json({ cases: cases.map(toCaseView) });
  });

  router.get('/me/cases/:id', async (request, response) => {
    const caseId = parseId(String(request.params.id));
    const owner = studentId(request);
    const record = caseId === null ? null : await repo.getCase(owner, caseId);
    if (!record || caseId === null) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    const sanctions = await repo.listSanctions(owner, { caseId });
    response.status(200).json({ case: toCaseDetailView(record, sanctions, manilaToday(now())) });
  });

  router.get('/me/sanctions', async (request, response) => {
    const sanctions = await repo.listSanctions(studentId(request));
    const today = manilaToday(now());
    response.status(200).json({ sanctions: sanctions.map((sanction) => toSanctionView(sanction, today)) });
  });

  router.get('/me/appointments', async (request, response) => {
    const today = manilaToday(now());
    const appointments = await repo.listAppointments(studentId(request));
    response.status(200).json({ appointments: appointments.map((record) => toAppointmentView(record, today)) });
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
        response.status(400).json({ error: 'invalid_term', message: 'academic_year (YYYY) and semester (1-3) are required together.' });
        return;
      }
    } else if (terms.length > 0) {
      year = terms[0].academicYear;
      semester = terms[0].semester;
    }

    const record = year === undefined || semester === undefined ? null : await repo.getClearance(owner, year, semester);
    const body: StudentClearanceResponse = { terms, clearance: record ? toClearanceView(record) : null };
    response.status(200).json(body);
  });

  return router;
}
