import type { RequestHandler } from 'express';
import type { StaffStudentListResponse, StaffStudentRecord } from '@shared/types.js';
import { STUDENT_ID_PATTERN } from '../domain/auth/policy.js';
import { sendError, sendOk } from '../helpers/http.js';
import type { StudentViewRepo } from '../repositories/me/repo.js';
import { manilaToday, sortTerms, toAppointmentView, toCaseView, toProfileView, toSanctionView } from '../views/me.views.js';
import { parseStudentSearchQuery } from '../validators/students.validators.js';

export const STUDENT_PAGE_SIZE = 20;

/**
 * Staff student records (SPEC 5): the list and one student's record. Staff only; a student never reaches these
 * (their own account details are `GET /me/profile`).
 */
export function createStudentsController({ repo, now }: { repo: StudentViewRepo; now: () => Date }) {
  const list: RequestHandler = async (request, response) => {
    const input = parseStudentSearchQuery(request.query);
    if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
    const { q, page } = input.value;
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
  };

  const record: RequestHandler = async (request, response) => {
    const id = String(request.params.id);
    const profile = STUDENT_ID_PATTERN.test(id) ? await repo.getProfile(id) : null;
    if (!profile) return sendError(response, 404, 'not_found', 'No student has that ID.');
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
      appointments: appointments.map((item) => toAppointmentView(item, today)),
      clearanceTerms: sortTerms(terms),
    };
    sendOk(response, body);
  };

  return { list, record };
}
