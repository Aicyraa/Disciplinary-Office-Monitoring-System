import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import {
  buildHarnessApp,
  signedInAgent,
  STAFF,
  STAFF_TEMP,
  STUDENT_A,
} from '../testing/harness.js';
import { createMemoryCaseQueries } from './memory-queries.js';
import { createMemoryCaseStore, type MemoryCaseStore } from './memory-store.js';
import { createCaseService } from './service.js';
import type { CaseRecord } from './types.js';

const S1 = STUDENT_A.id;
const REF = '11111111-1111-4111-8111-111111111111';
const NOW = new Date('2026-10-12T02:00:00Z');

let store: MemoryCaseStore;

function seedCase(overrides: Partial<CaseRecord> & { caseId: number }): void {
  store.state.cases.push({
    caseDate: new Date(Date.UTC(2026, 8, overrides.caseId, 2)),
    status: 'reported',
    severity: 'Minor',
    isEscalated: false,
    studentId: S1,
    handbookEntryId: 1,
    originalHandbookEntryId: null,
    source: 'gate',
    reportedByEmployeeId: null,
    claimedStudentId: S1,
    claimedName: 'Ana Cruz',
    submissionRef: null,
    resolvedWithoutSanction: false,
    dateResolved: null,
    ...overrides,
  });
  store.state.nextCaseId = Math.max(store.state.nextCaseId, overrides.caseId + 1);
}

function build() {
  const service = createCaseService({ store, now: () => NOW });
  const queries = createMemoryCaseQueries(store, new Map([[S1, 'Ana Cruz']]), new Map([[STAFF.id, 'Sam Reyes']]));
  return buildHarnessApp({ cases: { service, queries }, now: () => NOW });
}

beforeEach(() => {
  store = createMemoryCaseStore({
    students: new Set([S1, '2025-0000002']),
    handbook: [
      { handbookEntryId: 1, violationType: 'Improper uniform', severity: 'Minor', isSystem: false },
      { handbookEntryId: 2, violationType: 'No ID', severity: 'Minor', isSystem: false },
      { handbookEntryId: 3, violationType: 'Cheating', severity: 'Major', isSystem: false },
      { handbookEntryId: 68, violationType: '3 minor offense', severity: 'Major', isSystem: true },
    ],
  });
});

const staff = () => signedInAgent(build(), STAFF.email);

describe('access control (every case route)', () => {
  const routes: Array<[string, string]> = [
    ['get', '/cases'],
    ['get', '/cases/1'],
    ['post', '/cases'],
    ['get', `/submissions/${REF}/escalation-preview`],
    ['post', `/submissions/${REF}/validate`],
    ['post', `/submissions/${REF}/reject`],
    ['patch', '/cases/1/student'],
    ['post', '/cases/1/resolve'],
    ['post', '/cases/1/resolve-without-sanction'],
    ['post', '/cases/1/remarks'],
  ];

  test.each(routes)('%s %s is 401 without a session', async (method, path) => {
    const app = build();
    const response = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method](path);
    expect(response.status).toBe(401);
  });

  test.each(routes)('%s %s is 403 for a student', async (method, path) => {
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const response = await (agent as unknown as Record<string, (p: string) => request.Test>)[method](path);
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('forbidden');
  });

  test('is 403 password_change_required for staff who must change their password', async () => {
    const agent = await signedInAgent(build(), STAFF_TEMP.email);
    const response = await agent.get('/cases');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('password_change_required');
  });
});

describe('POST /cases', () => {
  test('records a violation as the signed-in staff member', async () => {
    const agent = await staff();
    const response = await agent.post('/cases').send({ studentId: S1, handbookEntryId: 1 });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true, data: { caseId: 1, conversions: [] } });
    expect(store.state.cases[0]).toMatchObject({ reportedByEmployeeId: STAFF.id, status: 'validated', source: 'staff' });
  });

  test('remarks are optional and kept as the first log entry; a non-text remark is 400', async () => {
    const agent = await staff();
    const ok = await agent.post('/cases').send({ studentId: S1, handbookEntryId: 1, remarks: 'Bring a guardian' });
    expect(ok.status).toBe(201);
    expect(store.state.history.filter((h) => h.eventType === 'remark').map((h) => h.remarks)).toEqual(['Bring a guardian']);
    const bad = await agent.post('/cases').send({ studentId: S1, handbookEntryId: 1, remarks: { text: 'x' } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('invalid_input');
  });

  test('the third minor returns the conversion', async () => {
    const agent = await staff();
    await agent.post('/cases').send({ studentId: S1, handbookEntryId: 1 });
    await agent.post('/cases').send({ studentId: S1, handbookEntryId: 2 });
    const third = await agent.post('/cases').send({ studentId: S1, handbookEntryId: 1 });
    expect(third.body).toEqual({ ok: true, data: { caseId: 3, conversions: [{ majorCaseId: 3, minorCaseIds: [1, 2] }] } });
  });

  test.each([
    [{}],
    [{ studentId: S1 }],
    [{ studentId: 'E001', handbookEntryId: 1 }],
    [{ studentId: S1, handbookEntryId: '1' }],
    [{ studentId: S1, handbookEntryId: 0 }],
    [{ studentId: S1, handbookEntryId: 1.5 }],
    [{ studentId: { $ne: '' }, handbookEntryId: 1 }],
  ])('rejects malformed input %j with 400', async (body) => {
    const agent = await staff();
    expect((await agent.post('/cases').send(body)).status).toBe(400);
    expect(store.state.cases).toHaveLength(0);
  });

  test('maps domain failures to 404 and 409', async () => {
    const agent = await staff();
    expect((await agent.post('/cases').send({ studentId: '2025-9999999', handbookEntryId: 1 })).status).toBe(404);
    expect((await agent.post('/cases').send({ studentId: S1, handbookEntryId: 999 })).status).toBe(404);
    const system = await agent.post('/cases').send({ studentId: S1, handbookEntryId: 68 });
    expect(system.status).toBe(409);
    expect(system.body.error.code).toBe('violation_not_allowed');
  });
});

describe('submissions', () => {
  beforeEach(() => {
    seedCase({ caseId: 1, submissionRef: REF });
    seedCase({ caseId: 2, submissionRef: REF, handbookEntryId: 2 });
  });

  test('preview then validate: 200, then 409 already_decided', async () => {
    const agent = await staff();
    expect((await agent.get(`/submissions/${REF}/escalation-preview`)).body).toEqual({ ok: true, data: { conversions: [] } });
    const validated = await agent.post(`/submissions/${REF}/validate`);
    expect(validated.status).toBe(200);
    expect(validated.body.data.caseIds).toEqual([1, 2]);
    const again = await agent.post(`/submissions/${REF}/validate`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('already_decided');
  });

  test('preview reports the case that would become the Major, then validate does it', async () => {
    seedCase({ caseId: 9, status: 'validated' });
    const agent = await staff();
    const preview = await agent.get(`/submissions/${REF}/escalation-preview`);
    expect(preview.body).toEqual({ ok: true, data: { conversions: [{ majorCaseId: 9, minorCaseIds: [1, 2] }] } });
    const validated = await agent.post(`/submissions/${REF}/validate`);
    expect(validated.body.data.conversions).toEqual(preview.body.data.conversions);
  });

  test('validate is 409 student_not_matched while the ID is unmatched, and works after linking', async () => {
    store.state.cases.forEach((c) => (c.studentId = null));
    const agent = await staff();
    const blocked = await agent.post(`/submissions/${REF}/validate`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('student_not_matched');

    expect((await agent.patch('/cases/1/student').send({ studentId: S1 })).status).toBe(200);
    expect((await agent.post(`/submissions/${REF}/validate`)).status).toBe(200);
  });

  test('reject needs a reason', async () => {
    const agent = await staff();
    const missing = await agent.post(`/submissions/${REF}/reject`).send({});
    expect(missing.status).toBe(400);
    const rejected = await agent.post(`/submissions/${REF}/reject`).send({ reason: 'Not the student' });
    expect(rejected.status).toBe(200);
    expect(store.state.cases.every((c) => c.status === 'rejected')).toBe(true);
  });

  test('a malformed or unknown reference is 404', async () => {
    const agent = await staff();
    expect((await agent.post('/submissions/not-a-uuid/validate')).status).toBe(404);
    expect((await agent.post('/submissions/22222222-2222-4222-8222-222222222222/validate')).status).toBe(404);
  });
});

describe('resolve, remarks and link', () => {
  test('resolve-without-sanction needs a reason and a validated case', async () => {
    seedCase({ caseId: 1, status: 'validated' });
    const agent = await staff();
    expect((await agent.post('/cases/1/resolve-without-sanction').send({})).status).toBe(400);
    expect((await agent.post('/cases/1/resolve-without-sanction').send({ reason: 'Warning only' })).status).toBe(200);
    const again = await agent.post('/cases/1/resolve-without-sanction').send({ reason: 'again' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('invalid_status');
  });

  test('resolve is 409 sanctions_incomplete until every sanction is completed', async () => {
    seedCase({ caseId: 1, status: 'for_sanction' });
    store.state.sanctions.set(1, ['pending_verification']);
    const agent = await staff();
    const blocked = await agent.post('/cases/1/resolve');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('sanctions_incomplete');
    store.state.sanctions.set(1, ['completed']);
    expect((await agent.post('/cases/1/resolve')).status).toBe(200);
  });

  test('remarks are appended to the timeline and shown in the detail', async () => {
    seedCase({ caseId: 1, status: 'validated' });
    const agent = await staff();
    expect((await agent.post('/cases/1/remarks').send({ remarks: 'Call the parent' })).status).toBe(201);
    const detail = await agent.get('/cases/1');
    expect(detail.body.data.case.timeline.at(-1)).toMatchObject({ eventType: 'remark', remarks: 'Call the parent', by: 'Sam Reyes' });
  });

  test.each(['abc', '0x1', '1.5', '-1'])('rejects id %s with 404', async (id) => {
    const agent = await staff();
    expect((await agent.post(`/cases/${id}/remarks`).send({ remarks: 'x' })).status).toBe(404);
  });
});

describe('GET /cases', () => {
  beforeEach(() => {
    for (let id = 1; id <= 8; id += 1) {
      seedCase({ caseId: id, status: id % 2 === 0 ? 'validated' : 'reported', handbookEntryId: id === 8 ? 3 : 1 });
    }
  });

  test('pages six at a time, newest first, with the total', async () => {
    const agent = await staff();
    const first = await agent.get('/cases');
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ total: 8, page: 1, pageSize: 6 });
    expect(first.body.data.cases.map((c: { id: number }) => c.id)).toEqual([8, 7, 6, 5, 4, 3]);
    const second = await agent.get('/cases?page=2');
    expect(second.body.data.cases.map((c: { id: number }) => c.id)).toEqual([2, 1]);
  });

  test('sorts oldest first', async () => {
    const agent = await staff();
    const response = await agent.get('/cases?sort=oldest');
    expect(response.body.data.cases.map((c: { id: number }) => c.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('filters by status and by class', async () => {
    const agent = await staff();
    const validated = await agent.get('/cases?status=validated');
    expect(validated.body.data.cases.map((c: { id: number }) => c.id)).toEqual([8, 6, 4, 2]);
    const major = await agent.get('/cases?class=Major');
    expect(major.body.data.cases.map((c: { id: number }) => c.id)).toEqual([8]);
  });

  test('searches by case code and by student name', async () => {
    const agent = await staff();
    expect((await agent.get('/cases?q=SDO-2026-005')).body.data.cases.map((c: { id: number }) => c.id)).toEqual([5]);
    expect((await agent.get('/cases?q=ana')).body.data.total).toBe(8);
    expect((await agent.get('/cases?q=nobody')).body.data.total).toBe(0);
  });

  test.each(['status=bogus', 'class=Medium', 'sort=random', 'page=0', 'page=abc', 'page=1.5'])('rejects %s with 400', async (query) => {
    const agent = await staff();
    expect((await agent.get(`/cases?${query}`)).status).toBe(400);
  });
});

describe('GET /cases/:id', () => {
  test('returns the detail with escalation links after a conversion', async () => {
    const agent = await staff();
    for (const handbookEntryId of [1, 2, 1]) await agent.post('/cases').send({ studentId: S1, handbookEntryId });
    const major = (await agent.get('/cases/3')).body.data.case;
    expect(major).toMatchObject({ code: 'SDO-2026-003', violation: '3 minor offense', severity: 'Major', convertedFrom: 'Improper uniform' });
    expect(major.createdFromCaseIds).toEqual([1, 2]);
    const minor = (await agent.get('/cases/1')).body.data.case;
    expect(minor).toMatchObject({ isEscalated: true, countedTowardCaseId: 3 });
  });

  test('an unknown id is 404', async () => {
    const agent = await staff();
    expect((await agent.get('/cases/404')).status).toBe(404);
  });
});

describe('GET /case-sanctions (staff queue)', () => {
  const sanction = (id: number, over: Record<string, unknown>) => ({
    caseSanctionId: id,
    caseId: 1,
    studentId: S1,
    caseStatus: 'for_sanction' as const,
    sanctionId: 2,
    sanctionType: 'Community service',
    status: 'assigned' as const,
    dueDate: '2026-10-20',
    dateAssigned: new Date('2026-10-01T02:00:00Z'),
    dateSubmitted: null,
    dateCompleted: null,
    staffNote: null,
    complianceNote: null,
    files: [],
    ...over,
  });

  function seed() {
    seedCase({ caseId: 1, status: 'for_sanction' });
    store.state.caseSanctions.push(
      sanction(1, { dueDate: '2026-10-05' }),
      sanction(2, { status: 'pending_verification', dueDate: '2026-10-09', dateSubmitted: new Date('2026-10-08T02:00:00Z') }),
      sanction(3, { dueDate: '2026-10-30' }),
      sanction(4, { status: 'completed', dueDate: '2026-10-01', dateCompleted: new Date('2026-10-02T02:00:00Z') }),
    );
  }

  test('lists active sanctions oldest due first, with counts; completed ones are left out', async () => {
    seed();
    const response = await (await staff()).get('/case-sanctions');
    expect(response.status).toBe(200);
    expect(response.body.data.sanctions.map((s: { id: number }) => s.id)).toEqual([1, 2, 3]);
    expect(response.body.data.counts).toEqual({ pendingVerification: 1, overdue: 2, active: 3 });
    expect(response.body.data.sanctions[0]).toMatchObject({
      caseCode: 'SDO-2026-001',
      sanctionCode: 'S-002',
      student: { id: S1, name: 'Ana Cruz' },
      lateByDays: 7,
      overdue: true,
    });
  });

  test('filters: pending_verification and overdue (today is 2026-10-12 in Manila)', async () => {
    seed();
    const agent = await staff();
    const pending = await agent.get('/case-sanctions').query({ filter: 'pending_verification' });
    expect(pending.body.data.sanctions.map((s: { id: number }) => s.id)).toEqual([2]);
    const overdue = await agent.get('/case-sanctions').query({ filter: 'overdue' });
    expect(overdue.body.data.sanctions.map((s: { id: number }) => s.id)).toEqual([1, 2]);
    expect(overdue.body.data.total).toBe(2);
  });

  test('a bad filter or page is 400; students and signed-out visitors are refused', async () => {
    const app = build();
    const agent = await signedInAgent(app, STAFF.email);
    expect((await agent.get('/case-sanctions').query({ filter: 'all' })).status).toBe(400);
    expect((await agent.get('/case-sanctions').query({ page: '0' })).status).toBe(400);
    expect((await request(app).get('/case-sanctions')).status).toBe(401);
    const student = await signedInAgent(app, STUDENT_A.email);
    expect((await student.get('/case-sanctions')).status).toBe(403);
  });
});
