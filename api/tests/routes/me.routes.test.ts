import request from 'supertest';
import { beforeAll, describe, expect, test } from 'vitest';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A, STUDENT_B, STUDENT_TEMP } from '../helpers/harness.js';
import { createMemoryStudentViewRepo } from '../../src/repositories/me/memory-repo.js';
import type { CaseRecord, CaseSanctionRecord } from '../../src/repositories/me/repo.js';

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
  assignedBy: 'Officer One',
  history: [{ eventType: 'assigned', remarks: null, byStaff: true, date: new Date('2026-09-02T02:00:00Z') }],
  files: [],
};

// "Today" in Manila is 2026-10-12 (the clock is 2026-10-11T20:00Z, already the 12th in Asia/Manila).
const NOW = new Date('2026-10-11T20:00:00Z');

const studentViews = createMemoryStudentViewRepo({
  profiles: [
    { studentId: STUDENT_A.id, firstName: 'Ana', lastName: 'Cruz', email: STUDENT_A.email, program: 'BS Information Technology', yearLevel: 2, isActive: true },
    { studentId: STUDENT_B.id, firstName: 'Ben', lastName: 'Lee', email: STUDENT_B.email, program: 'BS Accountancy', yearLevel: 3, isActive: true },
  ],
  cases: [
    {
      studentId: STUDENT_A.id,
      ...caseBase,
      source: 'gate',
      submissionCode: 'GI-1045',
      countedTowardCaseId: 3,
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
      linkedCaseIds: [1, 2],
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
    expect(response.body.error.code).toBe('password_change_required');
  });
});

describe('GET /me/cases', () => {
  test("returns only the signed-in student's cases, newest first, with display codes", async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const response = await agent.get('/me/cases');
    expect(response.status).toBe(200);
    expect(response.body.data.cases.map((c: { code: string }) => c.code)).toEqual(['SDO-2026-003', 'SDO-2026-001', 'SDO-2026-002']);
  });

  test('shows rejected cases and converted majors with their original minor', async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const { cases } = (await agent.get('/me/cases')).body.data;
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
    expect(response.body.data.case.timeline.map((t: { eventType: string }) => t.eventType)).toEqual(['reported', 'sanction_assigned']);
    expect(response.body.data.case.sanctions).toHaveLength(1);
    expect(response.body.data.case.sanctions[0]).toMatchObject({ id: 7, sanctionCode: 'S-003', dueDate: '2026-09-20', staffNote: 'Bring a signed slip.' });
  });

  test('carries the source and the escalation links as display codes (UI-POLISH-SPEC 5.15)', async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const one = (await agent.get('/me/cases/1')).body.data.case;
    expect(one).toMatchObject({ source: 'gate', submissionCode: 'GI-1045', countedTowardCode: 'SDO-2026-003', linkedCaseCodes: [] });
    const three = (await agent.get('/me/cases/3')).body.data.case;
    expect(three).toMatchObject({ source: 'staff', submissionCode: null, countedTowardCode: null, linkedCaseCodes: ['SDO-2026-001', 'SDO-2026-002'] });
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
    expect(response.body.data.sanctions.map((s: { id: number }) => s.id)).toEqual([7]);
    expect(response.body.data.sanctions[0].history[0]).toEqual({
      eventType: 'assigned',
      remarks: null,
      by: 'staff',
      date: '2026-09-02T02:00:00.000Z',
    });
    expect(JSON.stringify(response.body)).not.toContain('B only');
  });

  test('names the officer who assigned the sanction, never their id (UI-POLISH-SPEC D15)', async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const sanction = (await agent.get('/me/sanctions')).body.data.sanctions[0];
    expect(sanction.assignedBy).toBe('Officer One');
    expect(JSON.stringify(sanction)).not.toMatch(/employee/i);
  });

  test('a student with no data gets empty lists, not an error', async () => {
    const empty = buildHarnessApp({ studentViews: createMemoryStudentViewRepo(), now: () => NOW });
    const agent = await signedInAgent(empty, STUDENT_B.email);
    expect((await agent.get('/me/sanctions')).body).toEqual({ ok: true, data: { sanctions: [] } });
  });
});

describe('GET /me/sanctions: proof files, lateness and what the student may do (SPEC 4.3)', () => {
  const file = (id: number, viewed: boolean) => ({
    caseSanctionFileId: id,
    originalName: `proof-${id}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    dateUploaded: new Date('2026-10-03T02:00:00Z'),
    dateViewed: viewed ? new Date('2026-10-04T02:00:00Z') : null,
  });
  const repo = createMemoryStudentViewRepo({
    sanctions: [
      // returned, overdue by 7 Manila days (today is 2026-10-12), one old viewed file
      { studentId: STUDENT_A.id, ...sanctionBase, caseSanctionId: 21, status: 'returned', dueDate: new Date('2026-10-05T00:00:00Z'), files: [file(1, true)] },
      // pending, nothing opened yet: may still change the files, may not add more
      { studentId: STUDENT_A.id, ...sanctionBase, caseSanctionId: 22, status: 'pending_verification', dueDate: new Date('2026-10-30T00:00:00Z'), files: [file(2, false), file(3, false)] },
      // pending, staff opened one: already reviewed, so no changes
      { studentId: STUDENT_A.id, ...sanctionBase, caseSanctionId: 23, status: 'pending_verification', dueDate: new Date('2026-10-30T00:00:00Z'), files: [file(4, true), file(5, false)] },
      // completed late: measured at the completion day (Manila 2026-10-08), not today
      {
        studentId: STUDENT_A.id,
        ...sanctionBase,
        caseSanctionId: 24,
        status: 'completed',
        dueDate: new Date('2026-10-05T00:00:00Z'),
        dateCompleted: new Date('2026-10-08T02:00:00Z'),
        files: [file(6, true)],
      },
      { studentId: STUDENT_A.id, ...sanctionBase, caseSanctionId: 25, status: 'assigned', dueDate: new Date('2026-10-12T00:00:00Z'), files: [] },
    ],
  });

  async function sanctions() {
    const agent = await signedInAgent(buildHarnessApp({ studentViews: repo, now: () => NOW }), STUDENT_A.email);
    const body = (await agent.get('/me/sanctions')).body.data as { sanctions: Array<Record<string, unknown> & { id: number }> };
    return { body, byId: (id: number) => body.sanctions.find((s) => s.id === id)! };
  }

  test('computes lateness in Manila days, frozen at the completion day', async () => {
    const { byId } = await sanctions();
    expect(byId(21).lateByDays).toBe(7);
    expect(byId(22).lateByDays).toBe(0);
    expect(byId(24).lateByDays).toBe(3);
    expect(byId(25).lateByDays).toBe(0); // due today is not late
  });

  test('tells the screen what the student may do', async () => {
    const { byId } = await sanctions();
    expect([byId(25).canUpload, byId(25).canChangeFiles]).toEqual([true, false]); // assigned
    expect([byId(22).canUpload, byId(22).canChangeFiles]).toEqual([false, true]); // pending, unopened
    expect([byId(23).canUpload, byId(23).canChangeFiles]).toEqual([false, false]); // pending, reviewed
    expect([byId(21).canUpload, byId(21).canChangeFiles]).toEqual([true, true]); // returned
    expect([byId(24).canUpload, byId(24).canChangeFiles]).toEqual([false, false]); // completed
  });

  test('lists files by id and name only: no storage keys, viewer ids or viewed flags', async () => {
    const { body, byId } = await sanctions();
    expect(byId(22).files).toEqual([
      { id: 2, name: 'proof-2.pdf', mimeType: 'application/pdf', sizeBytes: 2048, dateUploaded: '2026-10-03T02:00:00.000Z' },
      { id: 3, name: 'proof-3.pdf', mimeType: 'application/pdf', sizeBytes: 2048, dateUploaded: '2026-10-03T02:00:00.000Z' },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/storage|viewed|employee/i);
  });
});

describe('GET /me/appointments', () => {
  test('buckets by Asia/Manila today: live and not ended is upcoming, the rest is history', async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const { appointments } = (await agent.get('/me/appointments')).body.data;
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
    expect(response.body.data.terms).toEqual([
      { academicYear: 2026, semester: 1, status: 'pending' },
      { academicYear: 2025, semester: 2, status: 'cleared' },
    ]);
    expect(response.body.data.clearance).toMatchObject({ academicYear: 2026, semester: 1, status: 'pending' });
    expect(response.body.data.clearance.items).toHaveLength(2);
  });

  test('selects a term by academic_year and semester', async () => {
    const response = await student.get('/me/clearance?academic_year=2025&semester=2');
    expect(response.body.data.clearance).toMatchObject({ academicYear: 2025, semester: 2, status: 'cleared' });
  });

  test('an unknown term returns clearance null', async () => {
    const response = await student.get('/me/clearance?academic_year=2020&semester=1');
    expect(response.status).toBe(200);
    expect(response.body.data.clearance).toBeNull();
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
    expect((await agent.get('/me/clearance')).body).toEqual({ ok: true, data: { terms: [], clearance: null } });
  });
});

describe('GET /me/clearance/slip', () => {
  test('a cleared term returns the slip data with the date the last requirement was done', async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const response = await agent.get('/me/clearance/slip').query({ academic_year: '2025', semester: '2' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body.data.slip).toEqual({
      student: expect.objectContaining({ studentId: STUDENT_A.id, firstName: 'Ana', program: 'BS Information Technology' }),
      academicYear: 2025,
      semester: 2,
      clearedOn: '2026-03-01',
      items: [{ label: 'Library', dateCompleted: '2026-03-01' }],
    });
  });

  test('a term that is not cleared is refused with 409 not_cleared', async () => {
    const agent = await signedInAgent(built(), STUDENT_A.email);
    const response = await agent.get('/me/clearance/slip').query({ academic_year: '2026', semester: '1' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('not_cleared');
  });

  test('another student term, a missing term and bad parameters', async () => {
    const agent = await signedInAgent(built(), STUDENT_B.email);
    expect((await agent.get('/me/clearance/slip').query({ academic_year: '2025', semester: '2' })).status).toBe(404);
    expect((await agent.get('/me/clearance/slip')).status).toBe(400);
    expect((await agent.get('/me/clearance/slip').query({ academic_year: '2025', semester: '4' })).status).toBe(400);
  });

  test('staff and signed-out visitors cannot read a slip', async () => {
    const app = built();
    expect((await request(app).get('/me/clearance/slip').query({ academic_year: '2025', semester: '2' })).status).toBe(401);
    const staff = await signedInAgent(app, STAFF.email);
    expect((await staff.get('/me/clearance/slip').query({ academic_year: '2025', semester: '2' })).status).toBe(403);
  });
});
