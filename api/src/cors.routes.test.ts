import bcrypt from 'bcryptjs';
import request from 'supertest';
import { describe, expect, test } from 'vitest';
import { createApp } from './app.js';
import { createMemoryAccountRepo } from './auth/memory-repo.js';
import { createAuthService } from './auth/service.js';

const CLIENT = 'http://localhost:5173';
const ALIAS = 'http://127.0.0.1:5173';

function appWith(loopbackAliases: boolean) {
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
      clientOrigin: CLIENT,
      loopbackAliases,
    },
  });
}

describe('CORS for the browser client', () => {
  test('the configured origin gets credentials on a normal request', async () => {
    const response = await request(appWith(false)).get('/auth/me').set('Origin', CLIENT);
    expect(response.headers['access-control-allow-origin']).toBe(CLIENT);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  test('the preflight for the JSON login request is answered for the configured origin', async () => {
    const response = await request(appWith(false))
      .options('/auth/login')
      .set('Origin', CLIENT)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(CLIENT);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-headers']).toMatch(/content-type/i);
  });

  test('in development the 127.0.0.1 spelling of the same client works, including the preflight and a real login', async () => {
    const app = appWith(true);
    const preflight = await request(app)
      .options('/auth/login')
      .set('Origin', ALIAS)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');
    expect(preflight.headers['access-control-allow-origin']).toBe(ALIAS);

    const login = await request(app)
      .post('/auth/login')
      .set('Origin', ALIAS)
      .send({ email: 'ana@students.nu-fairview.edu.ph', password: 'Passw0rd1' });
    expect(login.status).toBe(200);
    expect(login.headers['access-control-allow-origin']).toBe(ALIAS);
    expect(login.headers['access-control-allow-credentials']).toBe('true');
  });

  test.each(['http://localhost:4173', 'http://127.0.0.1:4173'])(
    'in development the built client served by `npm start` (%s) can preflight and sign in',
    async (origin) => {
      const app = appWith(true);
      const preflight = await request(app)
        .options('/auth/login')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');
      expect(preflight.status).toBe(204);
      expect(preflight.headers['access-control-allow-origin']).toBe(origin);

      const me = await request(app).get('/auth/me').set('Origin', origin);
      expect(me.status).toBe(401);
      expect(me.headers['access-control-allow-origin']).toBe(origin);
      expect(me.headers['access-control-allow-credentials']).toBe('true');

      const login = await request(app)
        .post('/auth/login')
        .set('Origin', origin)
        .send({ email: 'ana@students.nu-fairview.edu.ph', password: 'Passw0rd1' });
      expect(login.status).toBe(200);
      expect(login.headers['access-control-allow-origin']).toBe(origin);
    },
  );

  test('in production the preview origin is refused like any other', async () => {
    const response = await request(appWith(false)).get('/auth/me').set('Origin', 'http://localhost:4173');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('without aliases (production) the 127.0.0.1 spelling is refused: no CORS headers', async () => {
    const response = await request(appWith(false)).get('/auth/me').set('Origin', ALIAS);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test.each(['http://evil.example', 'http://localhost:5174', 'https://localhost:5173', 'null'])(
    'a foreign origin (%s) gets no CORS headers, even in development',
    async (origin) => {
      const response = await request(appWith(true)).get('/auth/me').set('Origin', origin);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    },
  );

  test('a request without an Origin header (curl, server to server) is not given CORS headers', async () => {
    const response = await request(appWith(true)).get('/auth/me');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('unconfigured development server', () => {
  const unconfigured = () =>
    createApp({
      unconfigured: { clientOrigin: CLIENT, reason: 'DATABASE_URL and SESSION_SECRET must be set in the root .env.', loopbackAliases: true },
    });

  test('/health still answers', async () => {
    expect((await request(unconfigured()).get('/health')).body).toEqual({ status: 'ok' });
  });

  test('every other route is a 503 that names the reason, with CORS headers so the browser can show it', async () => {
    const response = await request(unconfigured()).post('/auth/login').set('Origin', ALIAS).send({ email: 'x', password: 'y' });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: 'server_not_configured',
      message: 'DATABASE_URL and SESSION_SECRET must be set in the root .env.',
    });
    expect(response.headers['access-control-allow-origin']).toBe(ALIAS);
  });

  test('a foreign origin still gets no CORS headers', async () => {
    const response = await request(unconfigured()).get('/auth/me').set('Origin', 'http://evil.example');
    expect(response.status).toBe(503);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
