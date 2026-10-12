import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { createApp } from './app.js';
import { createMemoryAccountRepo } from './auth/memory-repo.js';
import { createAuthService } from './auth/service.js';

const CLIENT = 'http://localhost:5173';

function appWith(clientOrigin = CLIENT) {
  const repo = createMemoryAccountRepo([
    {
      role: 'student',
      id: '2025-0000001',
      email: 'ana@students.nu-fairview.edu.ph',
      firstName: 'Ana',
      lastName: 'Cruz',
      passwordHashed: bcrypt.hashSync('Passw0rd1', 4),
      mustChangePassword: false,
      isActive: true,
    },
  ]);
  return createApp({
    auth: {
      service: createAuthService({ repo, rounds: 4 }),
      sessionSecret: 'test-secret-test-secret-test-secret-1',
      clientOrigin,
    },
  });
}

describe('CORS: exactly one browser origin', () => {
  test('the client origin gets credentials on a normal request', async () => {
    const response = await request(appWith()).get('/auth/me').set('Origin', CLIENT);
    expect(response.headers['access-control-allow-origin']).toBe(CLIENT);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  test('the preflight for the JSON login request is answered for the client origin', async () => {
    const response = await request(appWith())
      .options('/auth/login')
      .set('Origin', CLIENT)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(CLIENT);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-headers']).toMatch(/content-type/i);
  });

  test('a real login from the client origin works and keeps the CORS headers', async () => {
    const login = await request(appWith())
      .post('/auth/login')
      .set('Origin', CLIENT)
      .send({ email: 'ana@students.nu-fairview.edu.ph', password: 'Passw0rd1' });
    expect(login.status).toBe(200);
    expect(login.body.ok).toBe(true);
    expect(login.headers['access-control-allow-origin']).toBe(CLIENT);
  });

  test.each([
    'http://127.0.0.1:5173',
    'http://[::1]:5173',
    'http://localhost:4173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://localhost:5173',
    'http://localhost.evil.example:5173',
    'http://evil.example',
    'null',
  ])('%s is a different origin: no CORS headers, not even for the preflight', async (origin) => {
    const app = appWith();
    const normal = await request(app).get('/auth/me').set('Origin', origin);
    expect(normal.headers['access-control-allow-origin']).toBeUndefined();
    const preflight = await request(app)
      .options('/auth/login')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('a request without an Origin header (curl, server to server) is not given CORS headers', async () => {
    const response = await request(appWith()).get('/auth/me');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('the origin is whatever APP_BASE_URL says, exactly (a real deployment)', async () => {
    const app = appWith('https://sdo.example.edu');
    const allowed = await request(app).get('/auth/me').set('Origin', 'https://sdo.example.edu');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://sdo.example.edu');
    const dev = await request(app).get('/auth/me').set('Origin', CLIENT);
    expect(dev.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('an app configured with something that is not an http(s) origin refuses to be built', () => {
    expect(() => appWith('localhost:5173')).toThrow(/http\(s\) origin/);
    expect(() => appWith('null')).toThrow(/http\(s\) origin/);
  });
});

describe('unconfigured development server', () => {
  const unconfigured = (clientOrigin = CLIENT) =>
    createApp({ unconfigured: { clientOrigin, reason: 'DATABASE_URL and SESSION_SECRET must be set in the root .env.' } });

  test('/health still answers with its plain probe body', async () => {
    expect((await request(unconfigured()).get('/health')).body).toEqual({ status: 'ok' });
  });

  test('every other route is a 503 failure envelope that names the reason, readable from the client origin', async () => {
    const response = await request(unconfigured()).post('/auth/login').set('Origin', CLIENT).send({ email: 'x', password: 'y' });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      error: { code: 'server_not_configured', message: 'DATABASE_URL and SESSION_SECRET must be set in the root .env.' },
    });
    expect(response.headers['access-control-allow-origin']).toBe(CLIENT);
  });

  test('when APP_BASE_URL itself is invalid, the default localhost origin can still read the reason', async () => {
    const response = await request(unconfigured('localhost:5173')).get('/auth/me').set('Origin', CLIENT);
    expect(response.status).toBe(503);
    expect(response.headers['access-control-allow-origin']).toBe(CLIENT);
  });

  test('a foreign origin gets no CORS headers', async () => {
    const response = await request(unconfigured()).get('/auth/me').set('Origin', 'http://evil.example');
    expect(response.status).toBe(503);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
