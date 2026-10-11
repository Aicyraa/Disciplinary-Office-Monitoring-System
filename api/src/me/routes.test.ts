import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A, STUDENT_B, STUDENT_TEMP } from '../testing/harness.js';
import { createMemoryStudentViewRepo } from './memory-repo.js';
import type { CaseRecord, CaseSanctionRecord } from './repo.js';

const caseBase: CaseRecord = {
  caseId: 1,
  status: 'for_sanction',
  caseDate: new Date('2026-09-01T02:00:00Z'),
  isEscalated: false,
  resolvedWithoutSanction: false,
  dateResolved: null,
  handbookSection: 'VI.D.1',
  violationType: 'Improper uniform',
  severity: 'Minor',
  originalViolationType: null,
};

const sanctionBase: CaseSanctionRecord = {
  caseSanctionId: 7,
  caseId: 1,
  caseSeverity: 'Minor',
  sanctionId: 3,
  sanctionType: 'Community service',
  description: 'Four hours.',
  status: 'assigned',
  dateAssigned: new Date('2026-09-02T02:00:00Z'),
  dueDate: new Date('2026-09-20T00:00:00Z'),
  dateSubmitted: null,
  dateCompleted: null,
  staffNote: 'Bring a signed slip.',
  complianceNote: null,
  history: [{ eventType: 'assigned', remarks: null, byStaff: true, date: new Date('2026-09-02T02:00:00Z') }],
};

// "Today" in Manila is 2026-10-12 (the clock is 2026-10-11T20:00Z, already the 12th in Asia/Manila).
const NOW = new Date('2026-10-11T20:00:00Z');

const studentViews = createMemoryStudentViewRepo({
  cases: [
    {
      studentId: STUDENT_A.id,
      ...caseBase,
      history: [
        { eventType: 'sanction_assigned', statusAfter: 'for_sanction', remarks: 'Assigned', date: new Date('2026-09-02T02:00:00Z') },
        { eventType: 'reported', statusAfter: 'reported', remarks: null, date: new Date('2026-09-01T02:00:00Z') },
      ],
    },
    { studentId: STUDENT_A.id, ...caseBase, caseId: 2, status: 'rejected', caseDate: new Date('2026-08-01T02:00:00Z') },
    {
      studentId: STUDENT_A.id,
      ...caseBase,
      caseId: 3,
      status: 'validated',
      violationType: '3 minor offense',
      severity: 'Major',
      originalViolationType: 'Improper uniform',
      caseDate: new Date('2026-09-10T02:00:00Z'),
    },
    { studentId: STUDENT_B.id, ...caseBase, caseId: 9 },
  ],
  sanctions: [
    { studentId: STUDENT_A.id, ...sanctionBase },
    { studentId: STUDENT_B.id, ...sanctionBase, caseSanctionId: 8, caseId: 9, staffNote: 'B only' },
  ],
  appointments: [
    // live, window still open today
    { studentId: STUDENT_A.id, appointmentId: 1, startDate: new Date('2026-10-10T00:00:00Z'), endDate: new Date('2026-10-12T00:00:00Z'), purpose: 'Counselling', notes: null, status: 'scheduled', cancelReason: null },
    // live but already ended
    { studentId: STUDENT_A.id, appointmentId: 2, startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-10-07T00:00:00Z'), purpose: 'Follow-up', notes: null, status: 'rescheduled', cancelReason: null },
    // future but cancelled
    { studentId: STUDENT_A.id, appointmentId: 3, startDate: new Date('2026-10-20T00:00:00Z'), endDate: new Date('2026-10-26T00:00:00Z'), purpose: 'Interview', notes: null, status: 'cancelled', cancelReason: 'Student ill' },
    { studentId: STUDENT_B.id, appointmentId: 4, startDate: new Date('2026-10-20T00:00:00Z'), endDate: new Date('2026-10-26T00:00:00Z'), purpose: 'B only', notes: null, status: 'scheduled', cancelReason: null },
  ],
  clearances: [
    {
      studentId: STUDENT_A.id,
      clearanceId: 1,
      academicYear: 2025,
      semester: 2,
      status: 'cleared',
      items: [{ requirementId: 1, label: 'Library', status: 'completed', remarks: null, dateCompleted: new Date('2026-03-01T02:00:00Z') }],
    },
    {
      studentId: STUDENT_A.id,
      clearanceId: 2,
      academicYear: 2026,
      semester: 1,
      status: 'pending',
      items: [
        { requirementId: 1, label: 'Library', status: 'pending', remarks: null, dateCompleted: null },
        { requirementId: 2, label: 'Discipline', status: 'completed', remarks: 'ok', dateCompleted: new Date('2026-10-01T02:00:00Z') },
      ],
    },
    { studentId: STUDENT_B.id, clearanceId: 3, academicYear: 2026, semester: 1, status: 'pending', items: [] },
  ],
});

const built = () => buildHarnessApp({ studentViews, now: () => NOW });

let student: Awaited<ReturnType<typeof signedInAgent>>;
beforeAll(async () => {
  student = await signedInAgent(built(), STUDENT_A.email);
});

describe('/me access control', () => {
  const paths = ['/me/cases', '/me/cases/1', '/me/sanctions', '/me/appointments', '/me/clearance'];

  test.each(paths)('%s is 401 without a session', async (path) => {
    expect((await request(built()).get(path)).status).toBe(401);
  });

  test.each(paths)('%s is 403 for staff', async (path) => {
    const agent = await signedInAgent(built(), STAFF.email);
    expect((await agent.get(path)).status).toBe(403);
  });

  test.each(paths)('%s is 403 password_change_required for a student flagged must-change', async (path) => {
    const agent = await signedInAgent(built(), STUDENT_TEMP.email);
    const response = await agent.get(path);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('password_change_required');
  });
});

describe('GET /me/cases', () => {
  test("returns only the signed-in student's cases, newest first, with display codes", async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const response = await agent.get('/me/cases');
    expect(response.status).toBe(200);
    expect(response.body.cases.map((c: { code: string }) => c.code)).toEqual(['C003', 'C001', 'C002']);
  });

  test('shows rejected cases and converted majors with their original minor', async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const { cases } = (await agent.get('/me/cases')).body;
    expect(cases.find((c: { id: number }) => c.id === 2).status).toBe('rejected');
    expect(cases.find((c: { id: number }) => c.id === 3)).toMatchObject({
      violation: '3 minor offense',
      severity: 'Major',
      convertedFrom: 'Improper uniform',
    });
  });

  test('never leaks staff-only or claimed fields', async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const text = JSON.stringify((await agent.get('/me/cases')).body);
    expect(text).not.toMatch(/employee|claimed|reported_by|reportedBy|studentId|submission/i);
  });
});

describe('GET /me/cases/:id', () => {
  test('returns the case with its timeline (oldest first) and sanctions', async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const response = await agent.get('/me/cases/1');
    expect(response.status).toBe(200);
    expect(response.body.case.timeline.map((t: { eventType: string }) => t.eventType)).toEqual(['reported', 'sanction_assigned']);
    expect(response.body.case.sanctions).toHaveLength(1);
    expect(response.body.case.sanctions[0]).toMatchObject({ id: 7, sanctionCode: 'S003', dueDate: '2026-09-20', staffNote: 'Bring a signed slip.' });
  });

  test("another student's case is a 404, indistinguishable from a missing one", async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const other = await agent.get('/me/cases/9');
    const missing = await agent.get('/me/cases/12345');
    expect(other.status).toBe(404);
    expect(other.body).toEqual(missing.body);
  });

  test.each(['abc', '1.5', '-1'])('rejects id %s with 404', async (id) => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    expect((await agent.get(`/me/cases/${id}`)).status).toBe(404);
  });
});

describe('GET /me/sanctions', () => {
  test("returns only the student's own sanctions and hides employee identities", async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const response = await agent.get('/me/sanctions');
    expect(response.status).toBe(200);
    expect(response.body.sanctions.map((s: { id: number }) => s.id)).toEqual([7]);
    expect(response.body.sanctions[0].history[0]).toEqual({
      eventType: 'assigned',
      remarks: null,
      by: 'staff',
      date: '2026-09-02T02:00:00.000Z',
    });
    expect(JSON.stringify(response.body)).not.toContain('B only');
  });

  test('a student with no data gets empty lists, not an error', async () => {
    const empty = buildHarnessApp({ studentViews: createMemoryStudentViewRepo(), now: () => NOW });
    const agent = await signedInAgent(empty, STUDENT_B.email);
    expect((await agent.get('/me/sanctions')).body).toEqual({ sanctions: [] });
  });
});

describe('GET /me/appointments', () => {
  test('buckets by Asia/Manila today: live and not ended is upcoming, the rest is history', async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const { appointments } = (await agent.get('/me/appointments')).body;
    const bucket = (id: number) => appointments.find((a: { id: number }) => a.id === id).bucket;
    expect(bucket(1)).toBe('upcoming'); // ends today (Manila 2026-10-12) - still open
    expect(bucket(2)).toBe('history'); // live status but window ended
    expect(bucket(3)).toBe('history'); // cancelled
    expect(appointments.find((a: { id: number }) => a.id === 3).cancelReason).toBe('Student ill');
  });

  test("does not include another student's appointments", async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    expect(JSON.stringify((await agent.get('/me/appointments')).body)).not.toContain('B only');
  });
});

describe('GET /me/clearance', () => {
  test('defaults to the newest term and lists all terms newest first', async () => {
    const response = await student.get('/me/clearance');
    expect(response.status).toBe(200);
    expect(response.body.terms).toEqual([
      { academicYear: 2026, semester: 1, status: 'pending' },
      { academicYear: 2025, semester: 2, status: 'cleared' },
    ]);
    expect(response.body.clearance).toMatchObject({ academicYear: 2026, semester: 1, status: 'pending' });
    expect(response.body.clearance.items).toHaveLength(2);
  });

  test('selects a term by academic_year and semester', async () => {
    const response = await student.get('/me/clearance?academic_year=2025&semester=2');
    expect(response.body.clearance).toMatchObject({ academicYear: 2025, semester: 2, status: 'cleared' });
  });

  test('an unknown term returns clearance null', async () => {
    const response = await student.get('/me/clearance?academic_year=2020&semester=1');
    expect(response.status).toBe(200);
    expect(response.body.clearance).toBeNull();
  });

  test.each([
    '?academic_year=2025',
    '?semester=2',
    '?academic_year=abcd&semester=1',
    '?academic_year=2025&semester=4',
    '?academic_year=2025&semester=1.5',
  ])('rejects the malformed term %s with 400', async (query) => {
    expect((await student.get(`/me/clearance${query}`)).status).toBe(400);
  });

  test('a student with no clearance gets terms [] and clearance null', async () => {
    const empty = buildHarnessApp({ studentViews: createMemoryStudentViewRepo(), now: () => NOW });
    const agent = await signedInAgent(empty, STUDENT_A.email);
    expect((await agent.get('/me/clearance')).body).toEqual({ terms: [], clearance: null });
  });
});
