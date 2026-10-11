import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { createApp } from '../app.js';
import { createMemoryAccountRepo, type MemoryAccountRepo } from './memory-repo.js';
import { createAuthService } from './service.js';

const ROUNDS = 4;
const STUDENT_EMAIL = 'ana.cruz@students.nu-fairview.edu.ph';
const STAFF_EMAIL = 'officer@nu-fairview.edu.ph';
const STUDENT_ID = '2025-0000001';
const PASSWORD = 'Passw0rd1';
const ORIGIN = 'http://localhost:5173';

let repo: MemoryAccountRepo;

function buildApp(loginRateLimit = { windowMs: 60_000, limit: 100 }) {
  const service = createAuthService({ repo, rounds: ROUNDS });
  return createApp({
    auth: { service, sessionSecret: 'test-secret-test-secret-test-secret-1', clientOrigin: ORIGIN, loginRateLimit },
  });
}

beforeEach(() => {
  const passwordHashed = bcrypt.hashSync(PASSWORD, ROUNDS);
  repo = createMemoryAccountRepo([
    { role: 'student', id: STUDENT_ID, email: STUDENT_EMAIL, firstName: 'Ana', lastName: 'Cruz', passwordHashed, mustChangePassword: false, isActive: true },
    { role: 'student', id: '2025-0000002', email: 'off@students.nu-fairview.edu.ph', firstName: 'Off', lastName: 'Duty', passwordHashed, mustChangePassword: false, isActive: false },
    { role: 'staff', id: 'E001', email: STAFF_EMAIL, firstName: 'Sam', lastName: 'Reyes', passwordHashed, mustChangePassword: false, isActive: true },
    { role: 'staff', id: 'E002', email: 'temp@nu-fairview.edu.ph', firstName: 'Tem', lastName: 'Po', passwordHashed, mustChangePassword: true, isActive: true },
  ]);
});

describe('POST /auth/login', () => {
  test('signs a student in and /auth/me returns the user without a password hash', async () => {
    const agent = request.agent(buildApp());
    const login = await agent.post('/auth/login').send({ email: STUDENT_EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.user).toEqual({
      role: 'student', id: STUDENT_ID, email: STUDENT_EMAIL, firstName: 'Ana', lastName: 'Cruz', mustChangePassword: false,
    });
    const me = await agent.get('/auth/me');
    expect(me.status).toBe(200);
    expect(JSON.stringify(me.body)).not.toMatch(/password_?hashed|\$2[aby]\$/i);
  });

  test('is case-insensitive on the email', async () => {
    const response = await request(buildApp()).post('/auth/login').send({ email: STAFF_EMAIL.toUpperCase(), password: PASSWORD });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('staff');
  });

  test('every failure returns the same status and body', async () => {
    const app = buildApp();
    const attempts = [
      { email: STUDENT_EMAIL, password: 'WrongPass1' },
      { email: 'nobody@students.nu-fairview.edu.ph', password: PASSWORD },
      { email: 'ana@gmail.com', password: PASSWORD },
      { email: 'off@students.nu-fairview.edu.ph', password: PASSWORD },
      { email: STUDENT_EMAIL },
      {},
    ];
    const responses = await Promise.all(attempts.map((body) => request(app).post('/auth/login').send(body)));
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual(responses[0].body);
    }
  });

  test('a correct password on a non-NU domain is refused', async () => {
    repo.accounts.set('student:2025-0000009', {
      id: '2025-0000009', email: 'sneaky@gmail.com', firstName: 'S', lastName: 'N',
      passwordHashed: bcrypt.hashSync(PASSWORD, ROUNDS), mustChangePassword: false, isActive: true,
    });
    const response = await request(buildApp()).post('/auth/login').send({ email: 'sneaky@gmail.com', password: PASSWORD });
    expect(response.status).toBe(401);
  });

  test('rate-limits repeated failures per IP, then still blocks a correct password', async () => {
    const app = buildApp({ windowMs: 60_000, limit: 3 });
    for (let i = 0; i < 3; i += 1) {
      expect((await request(app).post('/auth/login').send({ email: STUDENT_EMAIL, password: 'WrongPass1' })).status).toBe(401);
    }
    const blocked = await request(app).post('/auth/login').send({ email: STUDENT_EMAIL, password: PASSWORD });
    expect(blocked.status).toBe(429);
  });
});

describe('session lifecycle', () => {
  test('logout ends the session', async () => {
    const agent = request.agent(buildApp());
    await agent.post('/auth/login').send({ email: STUDENT_EMAIL, password: PASSWORD });
    expect((await agent.post('/auth/logout')).status).toBe(204);
    expect((await agent.get('/auth/me')).status).toBe(401);
  });

  test('unauthenticated /auth/me is 401', async () => {
    expect((await request(buildApp()).get('/auth/me')).status).toBe(401);
  });

  test('a session dies when the account is deactivated', async () => {
    const agent = request.agent(buildApp());
    await agent.post('/auth/login').send({ email: STUDENT_EMAIL, password: PASSWORD });
    const record = repo.accounts.get(`student:${STUDENT_ID}`)!;
    repo.accounts.set(`student:${STUDENT_ID}`, { ...record, isActive: false });
    expect((await agent.get('/auth/me')).status).toBe(401);
  });

  test('CORS allows only the client origin, with credentials', async () => {
    const app = buildApp();
    const allowed = await request(app).get('/auth/me').set('Origin', ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const denied = await request(app).get('/auth/me').set('Origin', 'http://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('session cookie is HttpOnly', async () => {
    const response = await request(buildApp()).post('/auth/login').send({ email: STUDENT_EMAIL, password: PASSWORD });
    expect(String(response.headers['set-cookie'])).toMatch(/HttpOnly/i);
  });
});

describe('POST /auth/change-password', () => {
  async function signedIn(email = STUDENT_EMAIL) {
    const agent = request.agent(buildApp());
    await agent.post('/auth/login').send({ email, password: PASSWORD });
    return agent;
  }

  test('requires a session', async () => {
    const response = await request(buildApp()).post('/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'NewPass123' });
    expect(response.status).toBe(401);
  });

  test.each([
    ['too short', 'ab1', 'weak_password'],
    ['no digit', 'abcdefghij', 'weak_password'],
    ['no letter', '1234567890', 'weak_password'],
    ['same as current', PASSWORD, 'same_password'],
  ])('rejects a new password that is %s', async (_label, newPassword, code) => {
    const response = await (await signedIn()).post('/auth/change-password').send({ currentPassword: PASSWORD, newPassword });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe(code);
  });

  test('rejects a wrong current password', async () => {
    const response = await (await signedIn()).post('/auth/change-password').send({ currentPassword: 'Nope12345', newPassword: 'NewPass123' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('wrong_password');
  });

  test('changes the password, and the new one works on the next sign-in', async () => {
    const app = buildApp();
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: STUDENT_EMAIL, password: PASSWORD });
    expect((await agent.post('/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'NewPass123' })).status).toBe(200);
    expect((await request(app).post('/auth/login').send({ email: STUDENT_EMAIL, password: PASSWORD })).status).toBe(401);
    expect((await request(app).post('/auth/login').send({ email: STUDENT_EMAIL, password: 'NewPass123' })).status).toBe(200);
  });
});

describe('POST /staff/students/:studentId/reset-password', () => {
  test('is 401 without a session', async () => {
    expect((await request(buildApp()).post(`/staff/students/${STUDENT_ID}/reset-password`)).status).toBe(401);
  });

  test('is 403 for a student', async () => {
    const agent = request.agent(buildApp());
    await agent.post('/auth/login').send({ email: STUDENT_EMAIL, password: PASSWORD });
    expect((await agent.post(`/staff/students/${STUDENT_ID}/reset-password`)).status).toBe(403);
  });

  test('is 403 for staff who still must change their password', async () => {
    const agent = request.agent(buildApp());
    await agent.post('/auth/login').send({ email: 'temp@nu-fairview.edu.ph', password: PASSWORD });
    const response = await agent.post(`/staff/students/${STUDENT_ID}/reset-password`);
    expect(response.status).toBe(403);
    expect(response.body.error).toBe('password_change_required');
  });

  test('rejects a malformed student id and an unknown student', async () => {
    const agent = request.agent(buildApp());
    await agent.post('/auth/login').send({ email: STAFF_EMAIL, password: PASSWORD });
    expect((await agent.post('/staff/students/not-an-id/reset-password')).status).toBe(400);
    expect((await agent.post('/staff/students/2025-9999999/reset-password')).status).toBe(404);
  });

  test('issues a one-time Temp-####, stores only its hash, and forces a change on next sign-in', async () => {
    const app = buildApp();
    const staff = request.agent(app);
    await staff.post('/auth/login').send({ email: STAFF_EMAIL, password: PASSWORD });
    const reset = await staff.post(`/staff/students/${STUDENT_ID}/reset-password`);
    expect(reset.status).toBe(200);
    const { tempPassword } = reset.body as { tempPassword: string };
    expect(tempPassword).toMatch(/^Temp-\d{4}$/);

    const stored = repo.accounts.get(`student:${STUDENT_ID}`)!;
    expect(stored.passwordHashed).not.toContain(tempPassword);
    expect(await bcrypt.compare(tempPassword, stored.passwordHashed)).toBe(true);
    expect(stored.mustChangePassword).toBe(true);

    const student = request.agent(app);
    const login = await student.post('/auth/login').send({ email: STUDENT_EMAIL, password: tempPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);

    // The temp password cannot be reused as the new password.
    const same = await student.post('/auth/change-password').send({ currentPassword: tempPassword, newPassword: tempPassword });
    expect(same.body.error).toBe('same_password');
    const changed = await student.post('/auth/change-password').send({ currentPassword: tempPassword, newPassword: 'Fresh1234' });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect(repo.accounts.get(`student:${STUDENT_ID}`)!.mustChangePassword).toBe(false);
  });
});
