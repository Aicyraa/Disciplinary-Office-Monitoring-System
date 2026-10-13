import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { createMemoryStudentViewRepo } from '../../src/repositories/me/memory-repo.js';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A, STUDENT_B } from '../helpers/harness.js';

const NOW = new Date('2026-10-11T20:00:00Z');

const profile = (studentId: string, firstName: string, lastName: string, program = 'BS Information Technology') => ({
  studentId,
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@students.nu-fairview.edu.ph`,
  program,
  yearLevel: 2,
  isActive: true,
});

const studentViews = createMemoryStudentViewRepo({
  profiles: [
    profile(STUDENT_A.id, 'Ana', 'Cruz'),
    profile(STUDENT_B.id, 'Ben', 'Lee', 'BS Accountancy'),
  ],
  cases: [
    {
      studentId: STUDENT_A.id,
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
    },
    {
      studentId: STUDENT_A.id,
      caseId: 2,
      status: 'resolved',
      caseDate: new Date('2026-08-01T02:00:00Z'),
      isEscalated: false,
      resolvedWithoutSanction: true,
      dateResolved: new Date('2026-08-05T02:00:00Z'),
      handbookSection: 'VI.D.2',
      violationType: 'Loitering',
      severity: 'Minor',
      originalViolationType: null,
    },
  ],
  sanctions: [
    {
      studentId: STUDENT_A.id,
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
      staffNote: null,
      complianceNote: null,
      history: [],
      files: [],
    },
  ],
  clearances: [{ studentId: STUDENT_A.id, clearanceId: 1, academicYear: 2026, semester: 1, status: 'pending', items: [] }],
});

const build = () => buildHarnessApp({ studentViews, now: () => NOW });

describe('GET /me/profile', () => {
  test('a student reads their own account details', async () => {
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const response = await agent.get('/me/profile');
    expect(response.status).toBe(200);
    expect(response.body.data.profile).toEqual({
      studentId: STUDENT_A.id,
      firstName: 'Ana',
      lastName: 'Cruz',
      email: 'ana.cruz@students.nu-fairview.edu.ph',
      program: 'BS Information Technology',
      yearLevel: 2,
      isActive: true,
    });
  });

  test('is 401 without a session and 403 for staff', async () => {
    const app = build();
    expect((await request(app).get('/me/profile')).status).toBe(401);
    const staff = await signedInAgent(app, STAFF.email);
    expect((await staff.get('/me/profile')).status).toBe(403);
  });
});

describe('GET /students', () => {
  test('staff list every student with open case and active sanction counts', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.get('/students');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ total: 2, page: 1, pageSize: 20 });
    expect(response.body.data.students).toEqual([
      expect.objectContaining({ studentId: STUDENT_A.id, openCases: 1, activeSanctions: 1 }),
      expect.objectContaining({ studentId: STUDENT_B.id, openCases: 0, activeSanctions: 0 }),
    ]);
  });

  test('q matches id, name, e-mail or program', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const byName = await staff.get('/students').query({ q: 'cruz' });
    expect(byName.body.data.students.map((s: { studentId: string }) => s.studentId)).toEqual([STUDENT_A.id]);
    const byProgram = await staff.get('/students').query({ q: 'accountancy' });
    expect(byProgram.body.data.total).toBe(1);
    const none = await staff.get('/students').query({ q: 'zzz' });
    expect(none.body.data).toMatchObject({ total: 0, students: [] });
  });

  test('a bad page or a repeated parameter is 400', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.get('/students').query({ page: '0' })).status).toBe(400);
    expect((await staff.get('/students?q=a&q=b')).status).toBe(400);
  });

  test('students and signed-out visitors cannot list students', async () => {
    const app = build();
    expect((await request(app).get('/students')).status).toBe(401);
    const student = await signedInAgent(app, STUDENT_A.email);
    expect((await student.get('/students')).status).toBe(403);
  });
});

describe('GET /students/:id', () => {
  test('staff read one record: profile, cases, sanctions, appointments and clearance terms', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.get(`/students/${STUDENT_A.id}`);
    expect(response.status).toBe(200);
    const record = response.body.data;
    expect(record.profile).toMatchObject({ studentId: STUDENT_A.id, firstName: 'Ana' });
    expect(record.cases.map((c: { code: string }) => c.code)).toEqual(['SDO-2026-001', 'SDO-2026-002']);
    expect(record.sanctions).toHaveLength(1);
    expect(record.sanctions[0]).toMatchObject({ sanctionCode: 'S-003', caseCode: 'SDO-2026-001' });
    expect(record.appointments).toEqual([]);
    expect(record.clearanceTerms).toEqual([{ academicYear: 2026, semester: 1, status: 'pending' }]);
  });

  test('no response body carries a password or hash field', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const list = JSON.stringify((await staff.get('/students')).body);
    const record = JSON.stringify((await staff.get(`/students/${STUDENT_A.id}`)).body);
    for (const body of [list, record]) expect(body).not.toMatch(/password|hash/i);
  });

  test('an unknown or malformed id is 404 and a student is 403', async () => {
    const app = build();
    const staff = await signedInAgent(app, STAFF.email);
    expect((await staff.get('/students/2025-9999999')).status).toBe(404);
    expect((await staff.get('/students/not-an-id')).status).toBe(404);
    const student = await signedInAgent(app, STUDENT_A.email);
    expect((await student.get(`/students/${STUDENT_B.id}`)).status).toBe(403);
  });
});
