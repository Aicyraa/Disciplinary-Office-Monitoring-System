import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A, STUDENT_B } from '../helpers/harness.js';
import { createMemoryClearanceQueries, createMemoryClearanceStore } from '../../src/repositories/clearance/memory-store.js';
import { createClearanceService } from '../../src/services/clearance.service.js';

// 2026-10-12 in Manila: the 1st Term of 2026-2027 under the assumed calendar (domain/clearance/term.ts).
const NOW = new Date('2026-10-12T02:00:00Z');

function build() {
  const store = createMemoryClearanceStore({ students: [STUDENT_A.id, STUDENT_B.id] });
  const service = createClearanceService({ store, now: () => NOW });
  const queries = createMemoryClearanceQueries(store, {
    students: { [STUDENT_A.id]: 'Ana Cruz', [STUDENT_B.id]: 'Ben Lee' },
    profiles: {
      [STUDENT_A.id]: { program: 'BSIT', yearLevel: 3 },
      [STUDENT_B.id]: { program: 'BSN', yearLevel: 2 },
    },
    staff: { [STAFF.id]: 'Officer One' },
  });
  return buildHarnessApp({ clearance: { service, queries }, now: () => NOW });
}

describe('GET /clearances/terms (UI-POLISH-SPEC D3)', () => {
  test('staff only', async () => {
    expect((await request(build()).get('/clearances/terms')).status).toBe(401);
    const student = await signedInAgent(build(), STUDENT_A.email);
    expect((await student.get('/clearances/terms')).status).toBe(403);
  });

  test('the current term first, then the terms that have clearances, newest first', async () => {
    const app = build();
    const staff = await signedInAgent(app, STAFF.email);
    await staff.post('/clearances').send({ studentId: STUDENT_A.id, academicYear: 2025, semester: 3 });
    const response = await staff.get('/clearances/terms');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      current: { academicYear: 2026, semester: 1 },
      terms: [
        { academicYear: 2026, semester: 1 },
        { academicYear: 2025, semester: 3 },
      ],
    });
  });
});

describe('GET /clearances/terms/:year/:semester/students (D3)', () => {
  test('every student for the term, with their clearance progress or none ("Not set")', async () => {
    const app = build();
    const staff = await signedInAgent(app, STAFF.email);
    const created = await staff.post('/clearances').send({ studentId: STUDENT_A.id, academicYear: 2026, semester: 1 });
    const response = await staff.get('/clearances/terms/2026/1/students');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      term: { academicYear: 2026, semester: 1 },
      students: [
        {
          studentId: STUDENT_A.id,
          name: 'Ana Cruz',
          program: 'BSIT',
          yearLevel: 3,
          clearance: { id: created.body.data.clearanceId, status: 'pending', done: 0, total: 4 },
        },
        { studentId: STUDENT_B.id, name: 'Ben Lee', program: 'BSN', yearLevel: 2, clearance: null },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
      notCleared: 2,
    });
  });

  test('search by name or ID', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.get('/clearances/terms/2026/1/students?q=ben');
    expect(response.body.data.students.map((s: { studentId: string }) => s.studentId)).toEqual([STUDENT_B.id]);
    expect(response.body.data.total).toBe(1);
  });

  test('bad term values are refused', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.get('/clearances/terms/26/1/students')).status).toBe(400);
    expect((await staff.get('/clearances/terms/2026/4/students')).status).toBe(400);
    expect((await staff.get('/clearances/terms/2026/1/students?page=0')).status).toBe(400);
  });
});
