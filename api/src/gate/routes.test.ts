import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { buildHarnessApp } from '../testing/harness.js';
import { createMemoryGateStore, type MemoryGateStore } from './memory-store.js';
import { createGateService } from './service.js';
import { MAX_AGE_MS, MIN_AGE_MS, signFormToken } from './token.js';

// The harness signs with this secret (testing/harness.ts sessionSecret).
const SECRET = 'test-secret-test-secret-test-secret-1';
const T0 = Date.parse('2026-10-12T02:00:00Z');

interface Built {
  app: ReturnType<typeof buildHarnessApp>;
  store: MemoryGateStore;
  clock: { now: number };
}

function build(limits?: { submits?: number; tokens?: number }): Built {
  const store = createMemoryGateStore({ students: ['2025-1030808'] });
  const clock = { now: T0 };
  const service = createGateService({ store, now: () => new Date(clock.now) });
  const app = buildHarnessApp({
    gate: { service, options: store, limits: { windowMs: 10 * 60_000, submits: limits?.submits ?? 5, tokens: limits?.tokens ?? 20 } },
    now: () => new Date(clock.now),
  });
  return { app, store, clock };
}

const body = (token: string, overrides: Record<string, unknown> = {}) => ({
  token,
  studentId: '2025-1030808',
  name: 'Ana Cruz',
  program: 'BS Computer Science',
  year: 3,
  violationIds: [1],
  ...overrides,
});

/** A token issued `ageMs` before "now". */
const tokenAged = (built: Built, ageMs: number) => signFormToken(SECRET, built.clock.now - ageMs);

describe('GET /public/gate-form-token and /public/gate-form-options (no sign-in)', () => {
  test('the token is issued without a session and is signed for the current time', async () => {
    const built = build();
    const response = await request(built.app).get('/public/gate-form-token');
    expect(response.status).toBe(200);
    expect(response.body.data.token).toBe(signFormToken(SECRET, T0));
  });

  test('the options list violations (no system entry, no sanctions or descriptions) and programs', async () => {
    const response = await request(build().app).get('/public/gate-form-options');
    expect(response.status).toBe(200);
    expect(response.body.data.violations).toEqual([
      { id: 1, name: 'Improper uniform', section: 'VI.D.1' },
      { id: 2, name: 'No ID', section: 'VI.D.2' },
    ]);
    expect(response.body.data.programs).toEqual(['BS Computer Science', 'BS Nursing']);
  });
});

describe('POST /public/gate-reports', () => {
  test('files the report: 201, a reference, one case per violation, nothing else in the response', async () => {
    const built = build();
    const response = await request(built.app)
      .post('/public/gate-reports')
      .send(body(tokenAged(built, 10_000), { violationIds: [1, 2] }));
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ reference: expect.stringMatching(/^[0-9a-f-]{36}$/), duplicate: false });
    expect(built.store.state.cases).toHaveLength(2);
  });

  test('a repeat is 200 with the same reference and duplicate: true', async () => {
    const built = build();
    const first = await request(built.app).post('/public/gate-reports').send(body(tokenAged(built, 10_000)));
    const again = await request(built.app).post('/public/gate-reports').send(body(tokenAged(built, 12_000)));
    expect(again.status).toBe(200);
    expect(again.body.data).toEqual({ reference: first.body.data.reference, duplicate: true });
    expect(built.store.state.cases).toHaveLength(1);
  });

  test('every failure is the same generic 400 (the response never says which check failed)', async () => {
    const built = build({ submits: 100 }); // the rate limit has its own tests below
    const attempts = [
      ['no token', body('', { token: undefined })],
      ['a garbage token', body('not-a-token')],
      ['a tampered token', body(`${T0 - 10_000}.${'0'.repeat(64)}`)],
      ['a token that is too fresh', body(tokenAged(built, MIN_AGE_MS - 1))],
      ['an expired token', body(tokenAged(built, MAX_AGE_MS + 1))],
      ['a malformed student id', body(tokenAged(built, 10_000), { studentId: '2025-12' })],
      ['no violations', body(tokenAged(built, 10_000), { violationIds: [] })],
      ['an unknown program', body(tokenAged(built, 10_000), { program: 'BS Nothing' })],
      ['an unknown violation', body(tokenAged(built, 10_000), { violationIds: [999] })],
      ['the system violation', body(tokenAged(built, 10_000), { violationIds: [68] })],
      ['an oversized body', body(tokenAged(built, 10_000), { name: 'x'.repeat(12_000) })],
    ] as const;
    const answers = [];
    for (const [, payload] of attempts) {
      const response = await request(built.app).post('/public/gate-reports').send(payload);
      expect(response.status).toBe(400);
      answers.push(JSON.stringify(response.body));
    }
    expect(new Set(answers).size).toBe(1);
    expect(JSON.parse(answers[0])).toEqual({
      ok: false,
      error: { code: 'invalid_input', message: expect.any(String) },
    });
    expect(built.store.state.cases).toHaveLength(0);
  });

  test('a body that is not JSON, or is far too big, gets the very same generic answer', async () => {
    const built = build({ submits: 100 });
    const generic = await request(built.app).post('/public/gate-reports').send(body('bad'));
    const notJson = await request(built.app)
      .post('/public/gate-reports')
      .set('Content-Type', 'application/json')
      .send('{"token": ');
    const huge = await request(built.app)
      .post('/public/gate-reports')
      .send(body(tokenAged(built, 10_000), { padding: 'x'.repeat(150_000) }));
    for (const response of [notJson, huge]) {
      expect(response.status).toBe(400);
      expect(response.body).toEqual(generic.body);
    }
  });

  test('a body over the report size cap is refused even when every field is valid', async () => {
    const built = build();
    const response = await request(built.app)
      .post('/public/gate-reports')
      .send(body(tokenAged(built, 10_000), { padding: 'x'.repeat(9_000) }));
    expect(response.status).toBe(400);
    expect(built.store.state.cases).toHaveLength(0);
  });

  test('extra fields such as status, source or student_id are ignored', async () => {
    const built = build();
    const response = await request(built.app)
      .post('/public/gate-reports')
      .send(body(tokenAged(built, 10_000), { status: 'validated', source: 'staff', studentId_override: 'x', student_id: 'E001' }));
    expect(response.status).toBe(201);
    expect(built.store.state.cases[0]).toMatchObject({ studentId: '2025-1030808', claimedStudentId: '2025-1030808' });
  });
});

describe('rate limits (per IP)', () => {
  test('the 6th submit in the window is 429 too_many_attempts, even with a valid token', async () => {
    const built = build();
    for (let i = 0; i < 5; i += 1) {
      const response = await request(built.app)
        .post('/public/gate-reports')
        .send(body(tokenAged(built, 10_000), { violationIds: [1], studentId: `2025-000000${i}` }));
      expect(response.status).toBe(201);
    }
    const sixth = await request(built.app).post('/public/gate-reports').send(body(tokenAged(built, 10_000)));
    expect(sixth.status).toBe(429);
    expect(sixth.body.error.code).toBe('too_many_attempts');
  });

  test('failed attempts count too, so a bot cannot probe forever', async () => {
    const built = build();
    for (let i = 0; i < 5; i += 1) {
      expect((await request(built.app).post('/public/gate-reports').send(body('bad'))).status).toBe(400);
    }
    expect((await request(built.app).post('/public/gate-reports').send(body('bad'))).status).toBe(429);
  });

  test('the token and options routes have their own, looser limit', async () => {
    const built = build({ tokens: 3 });
    for (let i = 0; i < 3; i += 1) {
      expect((await request(built.app).get('/public/gate-form-token')).status).toBe(200);
    }
    expect((await request(built.app).get('/public/gate-form-token')).status).toBe(429);
    // The submit limit is a separate counter.
    const response = await request(built.app).post('/public/gate-reports').send(body(tokenAged(built, 10_000)));
    expect(response.status).toBe(201);
  });
});
