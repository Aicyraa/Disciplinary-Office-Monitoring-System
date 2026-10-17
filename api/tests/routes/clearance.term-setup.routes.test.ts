import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A, STUDENT_B } from '../helpers/harness.js';
import { createMemoryClearanceQueries, createMemoryClearanceStore } from '../../src/repositories/clearance/memory-store.js';
import { createClearanceService } from '../../src/services/clearance.service.js';
import { SYSTEM_EMPLOYEE_ID } from '../../src/domain/clearance/rules.js';
import { JOB_KEY_HEADER } from '../../src/middlewares/jobKey.js';

const KEY = 'fake-job-key-for-tests-0123456789abcdef';
const PATH = '/internal/clearances/term-setup';
// 2026-10-12 in Manila: the 1st Term of 2026-2027.
const NOW = new Date('2026-10-12T02:00:00Z');

function build(jobKey: string | null = KEY) {
  const store = createMemoryClearanceStore({ students: [STUDENT_A.id, STUDENT_B.id], employees: [STAFF.id, SYSTEM_EMPLOYEE_ID] });
  const service = createClearanceService({ store, now: () => NOW });
  const queries = createMemoryClearanceQueries(store);
  const app = buildHarnessApp({ clearance: { service, queries }, clearanceJob: { service, jobKey: () => jobKey ?? undefined }, now: () => NOW });
  return { app, store };
}

describe(`POST ${PATH} (Power Automate term set-up)`, () => {
  test('without the job key header: 401 and nothing is created', async () => {
    const { app, store } = build();
    const response = await request(app).post(PATH).send({ academicYear: 2026, semester: 1 });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('not_authenticated');
    expect(store.state.clearances).toEqual([]);
  });

  test('with a wrong key: 401', async () => {
    const { app, store } = build();
    const response = await request(app).post(PATH).set(JOB_KEY_HEADER, `${KEY}x`).send({ academicYear: 2026, semester: 1 });
    expect(response.status).toBe(401);
    expect(store.state.clearances).toEqual([]);
  });

  test('a staff session is not enough: the key is still required', async () => {
    const { app } = build();
    const staff = await signedInAgent(app, STAFF.email);
    expect((await staff.post(PATH).send({ academicYear: 2026, semester: 1 })).status).toBe(401);
  });

  test.each([null, '', 'too-short'])('when PA_JOB_KEY is not set or too short (%s): 503 server_not_configured', async (configured) => {
    const { app, store } = build(configured);
    const response = await request(app).post(PATH).set(JOB_KEY_HEADER, configured ?? 'anything').send({});
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('server_not_configured');
    expect(store.state.clearances).toEqual([]);
  });

  test('with the key: 200, every active student gets a clearance, recorded under SYSTEM', async () => {
    const { app, store } = build();
    const response = await request(app).post(PATH).set(JOB_KEY_HEADER, KEY).send({ academicYear: 2026, semester: 2 });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: { term: { academicYear: 2026, semester: 2 }, activeStudents: 2, created: 2, skipped: 0 },
    });
    expect(store.state.clearances.map((c) => [c.studentId, c.academicYear, c.semester])).toEqual([
      [STUDENT_A.id, 2026, 2],
      [STUDENT_B.id, 2026, 2],
    ]);
    expect(store.state.history.every((entry) => entry.employeeId === SYSTEM_EMPLOYEE_ID)).toBe(true);
  });

  test('an empty body uses the current term (Asia/Manila)', async () => {
    const { app } = build();
    const response = await request(app).post(PATH).set(JOB_KEY_HEADER, KEY).send();
    expect(response.status).toBe(200);
    expect(response.body.data.term).toEqual({ academicYear: 2026, semester: 1 });
  });

  test('a second run creates nothing (safe to retry)', async () => {
    const { app } = build();
    await request(app).post(PATH).set(JOB_KEY_HEADER, KEY).send({ academicYear: 2026, semester: 1 });
    const again = await request(app).post(PATH).set(JOB_KEY_HEADER, KEY).send({ academicYear: 2026, semester: 1 });
    expect(again.body.data).toMatchObject({ created: 0, skipped: 2 });
  });

  test('a run notifies each new student and staff once; a retry adds no notifications', async () => {
    const { app, store } = build();
    await request(app).post(PATH).set(JOB_KEY_HEADER, KEY).send({});
    const summary = (n: { recipient: string; studentId: string | null }) => [n.recipient, n.studentId];
    expect(store.state.notifications.map(summary)).toEqual([
      ['student', STUDENT_A.id],
      ['student', STUDENT_B.id],
      ['staff', null],
    ]);
    await request(app).post(PATH).set(JOB_KEY_HEADER, KEY).send({});
    expect(store.state.notifications).toHaveLength(3);
  });

  test('a refused run (no key) notifies nobody', async () => {
    const { app, store } = build();
    await request(app).post(PATH).send({});
    expect(store.state.notifications).toEqual([]);
  });

  test.each([
    [{ academicYear: 2026 }],
    [{ semester: 1 }],
    [{ academicYear: 2026, semester: 5 }],
    [{ academicYear: '2026', semester: 1 }],
  ])('an invalid or half-given term %j is a 400', async (body) => {
    const { app, store } = build();
    const response = await request(app).post(PATH).set(JOB_KEY_HEADER, KEY).send(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_input');
    expect(store.state.clearances).toEqual([]);
  });

  test('a forged employee id in the body is ignored', async () => {
    const { app, store } = build();
    await request(app).post(PATH).set(JOB_KEY_HEADER, KEY).send({ academicYear: 2026, semester: 1, employeeId: STAFF.id });
    expect(store.state.history.every((entry) => entry.employeeId === SYSTEM_EMPLOYEE_ID)).toBe(true);
  });

  test('the route does not exist when the job is not wired', async () => {
    const store = createMemoryClearanceStore({ students: [STUDENT_A.id] });
    const service = createClearanceService({ store });
    const app = buildHarnessApp({ clearance: { service, queries: createMemoryClearanceQueries(store) } });
    expect((await request(app).post(PATH).set(JOB_KEY_HEADER, KEY).send({})).status).toBe(404);
  });
});
