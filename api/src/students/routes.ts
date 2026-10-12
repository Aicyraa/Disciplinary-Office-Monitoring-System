import { Router } from 'express';
import type { StaffStudentListResponse, StaffStudentRecord } from '@shared/types.js';
import { requireStaff } from '../auth/guards.js';
import { STUDENT_ID_PATTERN } from '../auth/policy.js';
import { sendError, sendOk } from '../http.js';
import type { StudentViewRepo } from '../me/repo.js';
import { manilaToday, sortTerms, toAppointmentView, toCaseView, toProfileView, toSanctionView } from '../me/views.js';

export const STUDENT_PAGE_SIZE = 20;
const MAX_QUERY_LENGTH = 100;

export interface StudentsRouterOptions {
  repo: StudentViewRepo;
  now?: () => Date;
}

/**
 * Staff student records (SPEC 5): the list and one student's record. Staff only; a student never reaches these
 * (their own account details are `GET /me/profile`). Resetting a password is `POST /staff/students/:id/reset-password`.
 */
export function createStudentsRouter({ repo, now = () => new Date() }: StudentsRouterOptions): Router {
  const router = Router();
  router.use('/students', ...requireStaff);

  router.get('/students', async (request, response) => {
    const rawQuery = request.query.q;
    const rawPage = request.query.page;
    if ((rawQuery !== undefined && typeof rawQuery !== 'string') || (rawPage !== undefined && typeof rawPage !== 'string')) {
      sendError(response, 400, 'invalid_input', 'q and page must each be given once.');
      return;
    }
    const q = rawQuery?.trim() ? rawQuery.trim() : null;
    if (q !== null && q.length > MAX_QUERY_LENGTH) {
      sendError(response, 400, 'invalid_input', `q is at most ${MAX_QUERY_LENGTH} characters.`);
      return;
    }
    if (rawPage !== undefined && !/^[1-9]\d{0,5}$/.test(rawPage)) {
      sendError(response, 400, 'invalid_input', 'page must be a positive number.');
      return;
    }
    const page = rawPage === undefined ? 1 : Number(rawPage);
    const { total, rows } = await repo.searchStudents({ q, page, pageSize: STUDENT_PAGE_SIZE });
    const body: StaffStudentListResponse = {
      students: rows.map((row) => ({
        ...toProfileView(row),
        openCases: row.openCases,
        activeSanctions: row.activeSanctions,
      })),
      total,
      page,
      pageSize: STUDENT_PAGE_SIZE,
    };
    sendOk(response, body);
  });

  router.get('/students/:id', async (request, response) => {
    const id = String(request.params.id);
    const profile = STUDENT_ID_PATTERN.test(id) ? await repo.getProfile(id) : null;
    if (!profile) {
      sendError(response, 404, 'not_found', 'No student has that ID.');
      return;
    }
    const today = manilaToday(now());
    const [cases, sanctions, appointments, terms] = await Promise.all([
      repo.listCases(id),
      repo.listSanctions(id),
      repo.listAppointments(id),
      repo.listClearanceTerms(id),
    ]);
    const body: StaffStudentRecord = {
      profile: toProfileView(profile),
      cases: cases.map(toCaseView),
      sanctions: sanctions.map((sanction) => toSanctionView(sanction, today)),
      appointments: appointments.map((record) => toAppointmentView(record, today)),
      clearanceTerms: sortTerms(terms),
    };
    sendOk(response, body);
  });

  return router;
}
