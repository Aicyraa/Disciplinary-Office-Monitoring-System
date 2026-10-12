import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A, STUDENT_B } from '../testing/harness.js';
import { createMemoryClearanceQueries, createMemoryClearanceStore, type MemoryClearanceStore } from './memory-store.js';
import { createClearanceService } from './service.js';

const NOW = new Date('2026-10-12T02:00:00Z');
let store: MemoryClearanceStore;

function build(openCases: Record<string, number> = {}) {
  store = createMemoryClearanceStore({ students: [STUDENT_A.id, STUDENT_B.id], openCases });
  const service = createClearanceService({ store, now: () => NOW });
  const queries = createMemoryClearanceQueries(store, {
    students: { [STUDENT_A.id]: 'Ana Cruz', [STUDENT_B.id]: 'Ben Lee' },
    staff: { [STAFF.id]: 'Officer One' },
  });
  return buildHarnessApp({ clearance: { service, queries }, now: () => NOW });
}

const term = (overrides: Record<string, unknown> = {}) => ({
  studentId: STUDENT_A.id,
  academicYear: 2026,
  semester: 1,
  ...overrides,
});

async function setUpFor(app = build()) {
  const staff = await signedInAgent(app, STAFF.email);
  const created = await staff.post('/clearances').send(term());
  return { staff, id: created.body.data.clearanceId as number };
}

beforeEach(() => {
  store = createMemoryClearanceStore();
});

describe('access control', () => {
  const routes: Array<[string, string]> = [
    ['get', '/clearances'],
    ['get', '/clearances/1'],
    ['post', '/clearances'],
    ['post', '/clearances/1/requirements'],
    ['delete', '/clearances/1/requirements/1'],
    ['post', '/clearances/1/requirements/1/complete'],
    ['post', '/clearances/1/requirements/1/reverse'],
  ];

  test.each(routes)('%s %s needs a session (401)', async (method, path) => {
    const response = await (request(build()) as unknown as Record<string, (p: string) => Promise<{ status: number }>>)[method](path);
    expect(response.status).toBe(401);
  });

  test.each(routes)('%s %s is staff only: a student gets 403', async (method, path) => {
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const response = await (agent as unknown as Record<string, (p: string) => Promise<{ status: number }>>)[method](path);
    expect(response.status).toBe(403);
  });
});

describe('POST /clearances (set up the standard requirements)', () => {
  test('201 with the four standard items, all pending', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.post('/clearances').send(term());
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ clearanceId: 1 });
    expect(store.state.clearances[0].items).toHaveLength(4);
  });

  test('the same student and term twice is a 409 clearance_exists', async () => {
    const { staff } = await setUpFor();
    const again = await staff.post('/clearances').send(term());
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('clearance_exists');
  });

  test.each([
    ['a malformed student id', { studentId: '2025-12' }, 400, 'invalid_input'],
    ['semester 4', { semester: 4 }, 400, 'invalid_input'],
    ['a text year', { academicYear: '2026' }, 400, 'invalid_input'],
    ['an unknown student', { studentId: '2099-9999999' }, 404, 'student_not_found'],
  ])('refuses %s', async (_label, override, status, code) => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.post('/clearances').send(term(override));
    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(store.state.clearances).toHaveLength(0);
  });
});

describe('GET /clearances and /clearances/:id', () => {
  test('lists with the student name, progress and the warning hint, and a detail with the history', async () => {
    const { staff, id } = await setUpFor(build({ [STUDENT_A.id]: 2 }));
    await staff.post(`/clearances/${id}/requirements/1/complete`).send({ remarks: 'checked' });

    const list = await staff.get('/clearances');
    expect(list.status).toBe(200);
    expect(list.body.data.total).toBe(1);
    const row = list.body.data.clearances[0];
    expect(row).toMatchObject({ id, student: { id: STUDENT_A.id, name: 'Ana Cruz' }, status: 'pending', openCases: 2 });
    expect(row.items.find((i: { requirementId: number }) => i.requirementId === 1)).toMatchObject({
      status: 'completed',
      completedBy: 'Officer One',
      warning: true, // "No active violations" is done while the student still has open cases
    });
    expect(row.items.find((i: { requirementId: number }) => i.requirementId === 2)).toMatchObject({ status: 'pending', warning: false });

    const detail = await staff.get(`/clearances/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.clearance.history.map((h: { eventType: string }) => h.eventType)).toEqual(['set_up', 'marked_done']);
    expect(detail.body.data.clearance.history[1]).toMatchObject({ requirement: 'No active violations', by: 'Officer One' });
  });

  test('no warning when the student has no open cases', async () => {
    const { staff, id } = await setUpFor();
    await staff.post(`/clearances/${id}/requirements/1/complete`).send({});
    const detail = await staff.get(`/clearances/${id}`);
    expect(detail.body.data.clearance.items[0].warning).toBe(false);
  });

  test('filters by status and searches by student', async () => {
    const app = build();
    const staff = await signedInAgent(app, STAFF.email);
    await staff.post('/clearances').send(term());
    await staff.post('/clearances').send(term({ studentId: STUDENT_B.id }));
    for (const rid of [1, 2, 3, 4]) await staff.post(`/clearances/2/requirements/${rid}/complete`).send({});

    const cleared = await staff.get('/clearances').query({ status: 'cleared' });
    expect(cleared.body.data.clearances.map((c: { id: number }) => c.id)).toEqual([2]);
    const found = await staff.get('/clearances').query({ q: 'ana' });
    expect(found.body.data.clearances.map((c: { id: number }) => c.id)).toEqual([1]);
  });

  test.each([{ status: 'done' }, { page: '0' }, { page: 'x' }])('rejects the query %j', async (query) => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.get('/clearances').query(query)).status).toBe(400);
  });

  test('an unknown or malformed id is a 404', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.get('/clearances/99')).status).toBe(404);
    expect((await staff.get('/clearances/abc')).status).toBe(404);
  });
});

describe('items: complete, reverse, add, remove', () => {
  test('complete marks done; the last one makes the clearance cleared and says so', async () => {
    const { staff, id } = await setUpFor();
    for (const rid of [1, 2, 3]) {
      const response = await staff.post(`/clearances/${id}/requirements/${rid}/complete`).send({});
      expect(response.body.data).toEqual({ cleared: false });
    }
    const last = await staff.post(`/clearances/${id}/requirements/4/complete`).send({ remarks: 'Signed' });
    expect(last.status).toBe(200);
    expect(last.body.data).toEqual({ cleared: true });
    expect(store.state.clearances[0].status).toBe('cleared');
  });

  test('completing twice is a 409', async () => {
    const { staff, id } = await setUpFor();
    await staff.post(`/clearances/${id}/requirements/1/complete`).send({});
    const again = await staff.post(`/clearances/${id}/requirements/1/complete`).send({});
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('invalid_status');
  });

  test('reverse needs a reason', async () => {
    const { staff, id } = await setUpFor();
    await staff.post(`/clearances/${id}/requirements/1/complete`).send({});
    expect((await staff.post(`/clearances/${id}/requirements/1/reverse`).send({})).status).toBe(400);
    expect((await staff.post(`/clearances/${id}/requirements/1/reverse`).send({ reason: 'Marked by mistake' })).status).toBe(200);
    expect(store.state.clearances[0].items[0].status).toBe('pending');
  });

  test('add a custom item, then add it again (409), then remove it', async () => {
    const { staff, id } = await setUpFor();
    const added = await staff.post(`/clearances/${id}/requirements`).send({ label: 'Library clearance' });
    expect(added.status).toBe(201);
    const requirementId = added.body.data.requirementId as number;
    const again = await staff.post(`/clearances/${id}/requirements`).send({ label: 'library clearance' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('requirement_exists');
    expect((await staff.delete(`/clearances/${id}/requirements/${requirementId}`)).status).toBe(200);
    expect(store.state.clearances[0].items).toHaveLength(4);
  });

  test('a label is required', async () => {
    const { staff, id } = await setUpFor();
    expect((await staff.post(`/clearances/${id}/requirements`).send({})).status).toBe(400);
  });

  test.each(['abc', '0x1', '1.5', '-1'])('a malformed id %s is a 404', async (value) => {
    const { staff, id } = await setUpFor();
    expect((await staff.post(`/clearances/${value}/requirements/1/complete`).send({})).status).toBe(404);
    expect((await staff.post(`/clearances/${id}/requirements/${value}/complete`).send({})).status).toBe(404);
    expect((await staff.delete(`/clearances/${id}/requirements/${value}`)).status).toBe(404);
  });

  test('a requirement that is not on the clearance is a 404', async () => {
    const { staff, id } = await setUpFor();
    expect((await staff.post(`/clearances/${id}/requirements/77/complete`).send({})).status).toBe(404);
  });
});

describe('the student only reads', () => {
  test('/me/clearance stays the only clearance route a student can use', async () => {
    const student = await signedInAgent(build(), STUDENT_A.email);
    expect((await student.get('/me/clearance')).status).toBe(200);
    expect((await student.get('/clearances')).status).toBe(403);
  });
});
