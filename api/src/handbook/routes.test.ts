import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { buildHarnessApp, signedInAgent, STAFF, STAFF_TEMP, STUDENT_A } from '../testing/harness.js';
import { createMemoryHandbookRepo } from './memory-repo.js';
import type { HandbookEntryRecord } from './repo.js';

const entries: HandbookEntryRecord[] = [
  {
    handbookEntryId: 1,
    handbookSection: 'VI.D.1',
    violation: { violationId: 1, violationType: 'Improper uniform', severity: 'Minor', description: 'Not wearing the uniform.', isSystem: false },
    sanctions: [
      { offenseNumber: 2, sanctionId: 2, sanctionType: 'CATEGORY - 2', description: 'Second offense.' },
      { offenseNumber: 1, sanctionId: 1, sanctionType: 'Violation Slip', description: 'First offense.' },
    ],
  },
  {
    handbookEntryId: 68,
    handbookSection: 'VI.E.20',
    violation: { violationId: 68, violationType: '3 minor offense', severity: 'Major', description: 'System only.', isSystem: true },
    sanctions: [],
  },
];

const app = () => buildHarnessApp({ handbook: createMemoryHandbookRepo(entries) });

describe('GET /handbook', () => {
  test('is 401 without a session', async () => {
    expect((await request(app()).get('/handbook')).status).toBe(401);
  });

  test('is 403 password_change_required for an account that must change its password', async () => {
    const built = app();
    const agent = await signedInAgent(built, STAFF_TEMP.email);
    const response = await agent.get('/handbook');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('password_change_required');
  });

  test.each([
    ['student', STUDENT_A.email],
    ['staff', STAFF.email],
  ])('lists entries for a %s, hiding system entries', async (_role, email) => {
    const built = app();
    const agent = await signedInAgent(built, email);
    const response = await agent.get('/handbook');
    expect(response.status).toBe(200);
    expect(response.body.data.entries.map((entry: { id: number }) => entry.id)).toEqual([1]);
  });

  test('derives display codes and orders sanctions by offense number', async () => {
    const built = app();
    const agent = await signedInAgent(built, STUDENT_A.email);
    const { entries: listed } = (await agent.get('/handbook')).body.data;
    expect(listed[0]).toMatchObject({
      code: 'H001',
      violationCode: 'V001',
      violation: 'Improper uniform',
      severity: 'Minor',
      section: 'VI.D.1',
    });
    expect(listed[0].sanctions.map((s: { offenseNumber: number; sanctionCode: string }) => [s.offenseNumber, s.sanctionCode])).toEqual([
      [1, 'S001'],
      [2, 'S002'],
    ]);
  });
});

describe('GET /handbook/:id', () => {
  test('returns one entry', async () => {
    const built = app();
    const agent = await signedInAgent(built, STUDENT_A.email);
    const response = await agent.get('/handbook/1');
    expect(response.status).toBe(200);
    expect(response.body.data.entry.violation).toBe('Improper uniform');
  });

  test('a system entry is a 404 even by direct id', async () => {
    const built = app();
    const agent = await signedInAgent(built, STUDENT_A.email);
    expect((await agent.get('/handbook/68')).status).toBe(404);
  });

  test.each(['999', 'abc', '1.5', '-1', '1; drop'])('rejects %s with 404', async (id) => {
    const built = app();
    const agent = await signedInAgent(built, STUDENT_A.email);
    expect((await agent.get(`/handbook/${encodeURIComponent(id)}`)).status).toBe(404);
  });
});
