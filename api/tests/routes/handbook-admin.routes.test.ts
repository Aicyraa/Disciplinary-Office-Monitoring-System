import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A } from '../helpers/harness.js';
import { createMemoryHandbookAdminStore } from '../../src/repositories/handbook/admin-memory-store.js';
import { createHandbookAdminService } from '../../src/services/handbook-admin.service.js';
import { createMemoryHandbookRepo } from '../../src/repositories/handbook/memory-repo.js';
import type { HandbookEntryRecord } from '../../src/repositories/handbook/repo.js';

const entries: HandbookEntryRecord[] = [
  {
    handbookEntryId: 1,
    handbookSection: 'VI.D.1',
    violation: { violationId: 1, violationType: 'Improper uniform', severity: 'Minor', description: 'Not wearing the uniform.', isSystem: false },
    sanctions: [{ offenseNumber: 1, sanctionId: 1, sanctionType: 'Violation Slip', description: 'First offense.' }],
  },
  {
    handbookEntryId: 68,
    handbookSection: 'VI.E.20',
    violation: { violationId: 68, violationType: '3 minor offense', severity: 'Major', description: 'System only.', isSystem: true },
    sanctions: [],
  },
];

function build() {
  const store = createMemoryHandbookAdminStore({
    records: [
      {
        handbookEntryId: 1,
        violationId: 1,
        violationType: 'Improper uniform',
        severity: 'Minor',
        description: 'Not wearing the uniform.',
        isSystem: false,
        section: 'VI.D.1',
        sanctions: [{ offenseNumber: 1, sanctionId: 1 }],
      },
      {
        handbookEntryId: 68,
        violationId: 68,
        violationType: '3 minor offense',
        severity: 'Major',
        description: 'System only.',
        isSystem: true,
        section: 'VI.E.20',
        sanctions: [],
      },
    ],
    cases: { 1: 4 },
  });
  const app = buildHarnessApp({
    handbook: createMemoryHandbookRepo(entries, { 1: 4 }),
    handbookAdmin: { service: createHandbookAdminService({ store }) },
  });
  return { app, store };
}

const body = (overrides: Record<string, unknown> = {}) => ({
  violationType: 'Loitering',
  severity: 'Minor',
  section: 'VI.D.9',
  description: 'Staying in a restricted area.',
  sanctions: [{ offenseNumber: 1, sanctionId: 1 }],
  ...overrides,
});

describe('access control', () => {
  test.each([
    ['post', '/handbook'],
    ['patch', '/handbook/1'],
  ])('%s %s needs a session (401)', async (method, path) => {
    const response = await (request(build().app) as unknown as Record<string, (p: string) => Promise<{ status: number }>>)[method](path);
    expect(response.status).toBe(401);
  });

  test.each([
    ['post', '/handbook'],
    ['patch', '/handbook/1'],
  ])('%s %s is staff only: a student gets 403', async (method, path) => {
    const student = await signedInAgent(build().app, STUDENT_A.email);
    const response = await (student as unknown as Record<string, (p: string) => Promise<{ status: number }>>)[method](path);
    expect(response.status).toBe(403);
  });
});

describe('used in N cases', () => {
  test('staff see usedInCases on every entry', async () => {
    const staff = await signedInAgent(build().app, STAFF.email);
    const response = await staff.get('/handbook');
    expect(response.body.data.entries[0]).toMatchObject({ id: 1, usedInCases: 4 });
  });

  test('students never receive it', async () => {
    const student = await signedInAgent(build().app, STUDENT_A.email);
    const response = await student.get('/handbook');
    expect(response.body.data.entries[0]).not.toHaveProperty('usedInCases');
  });
});

describe('POST /handbook', () => {
  test('staff add a violation: 201 and the new id', async () => {
    const { app, store } = build();
    const staff = await signedInAgent(app, STAFF.email);
    const response = await staff.post('/handbook').send(body());
    expect(response.status).toBe(201);
    const id = response.body.data.handbookEntryId as number;
    expect(store.entry(id)).toMatchObject({ violationType: 'Loitering', isSystem: false, sanctions: [{ offenseNumber: 1, sanctionId: 1 }] });
  });

  test('a client cannot create a system entry or pick ids', async () => {
    const { app, store } = build();
    const staff = await signedInAgent(app, STAFF.email);
    const response = await staff.post('/handbook').send(body({ isSystem: true, violationId: 1, handbookEntryId: 1 }));
    expect(response.status).toBe(201);
    const created = store.entry(response.body.data.handbookEntryId as number);
    expect(created?.isSystem).toBe(false);
    expect(created?.violationId).not.toBe(1);
  });

  test('a duplicate name is a 409 violation_exists', async () => {
    const staff = await signedInAgent(build().app, STAFF.email);
    const response = await staff.post('/handbook').send(body({ violationType: 'improper UNIFORM' }));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('violation_exists');
  });

  test('invalid input is a 400', async () => {
    const staff = await signedInAgent(build().app, STAFF.email);
    const response = await staff.post('/handbook').send(body({ severity: 'Severe' }));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_input');
  });
});

describe('PATCH /handbook/:id', () => {
  test('staff edit the text and the sanctions', async () => {
    const { app, store } = build();
    const staff = await signedInAgent(app, STAFF.email);
    const response = await staff.patch('/handbook/1').send({ description: 'New text.', sanctions: [{ offenseNumber: 1, sanctionId: 2 }] });
    expect(response.status).toBe(200);
    expect(store.entry(1)).toMatchObject({ description: 'New text.', sanctions: [{ offenseNumber: 1, sanctionId: 2 }] });
  });

  test('the category of a violation used in cases is a 409 violation_in_use', async () => {
    const { app, store } = build();
    const staff = await signedInAgent(app, STAFF.email);
    const response = await staff.patch('/handbook/1').send({ severity: 'Major' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('violation_in_use');
    expect(store.entry(1)?.severity).toBe('Minor');
  });

  test('is_system and the violation id cannot be changed through the body', async () => {
    const { app, store } = build();
    const staff = await signedInAgent(app, STAFF.email);
    const response = await staff.patch('/handbook/1').send({ description: 'x', isSystem: true, violationId: 68 });
    expect(response.status).toBe(200);
    expect(store.entry(1)).toMatchObject({ isSystem: false, violationId: 1 });
  });

  test('the system entry is a 404; an unknown or malformed id is a 404', async () => {
    const staff = await signedInAgent(build().app, STAFF.email);
    expect((await staff.patch('/handbook/68').send({ description: 'x' })).status).toBe(404);
    expect((await staff.patch('/handbook/999').send({ description: 'x' })).status).toBe(404);
    expect((await staff.patch('/handbook/abc').send({ description: 'x' })).status).toBe(404);
  });

  test('an empty change is a 400', async () => {
    const staff = await signedInAgent(build().app, STAFF.email);
    expect((await staff.patch('/handbook/1').send({})).status).toBe(400);
  });
});
