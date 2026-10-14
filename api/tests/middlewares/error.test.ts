import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { ApiFailure } from '@shared/types.js';
import { app as healthOnlyApp, createApp } from '../../src/app.js';
import { createMemoryAccountRepo } from '../../src/repositories/auth/memory-repo.js';
import { createAuthService } from '../../src/services/auth.service.js';
import { HttpError, sendError, sendOk } from '../../src/helpers/http.js';
import { errorHandler, notFoundHandler } from '../../src/middlewares/error.js';

const failure = (code: ApiFailure['error']['code'], message: string): ApiFailure => ({ ok: false, error: { code, message } });

describe('sendOk and sendError', () => {
  const app = express();
  app.get('/ok', (_q, response) => sendOk(response, { n: 1 }));
  app.get('/created', (_q, response) => sendOk(response, { id: 7 }, 201));
  app.get('/nothing', (_q, response) => sendOk(response, null));
  app.get('/bad', (_q, response) => sendError(response, 409, 'already_decided', 'Already decided.'));

  test('success: ok true with the payload under data', async () => {
    const response = await request(app).get('/ok');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, data: { n: 1 } });
  });

  test('success with a status and with no payload', async () => {
    const created = await request(app).get('/created');
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ ok: true, data: { id: 7 } });
    expect((await request(app).get('/nothing')).body).toEqual({ ok: true, data: null });
  });

  test('failure: ok false with a code and message under error', async () => {
    const response = await request(app).get('/bad');
    expect(response.status).toBe(409);
    expect(response.body).toEqual(failure('already_decided', 'Already decided.'));
  });
});

describe('notFoundHandler and errorHandler in isolation', () => {
  let errorLog: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errorLog.mockRestore();
  });

  function build() {
    const app = express();
    app.use(express.json({ limit: '1kb' }));
    app.post('/echo', (request, response) => sendOk(response, request.body));
    app.get('/throws', () => {
      throw new Error('SECRET: relation "student_accounts" does not exist at db.internal:5432');
    });
    app.get('/rejects', async () => {
      await Promise.resolve();
      throw new Error('SECRET async detail');
    });
    app.get('/next-error', (_q, _r, next) => next(new Error('SECRET passed to next')));
    app.get('/http-error', () => {
      throw new HttpError(409, 'already_decided', 'Someone else already decided this.');
    });
    app.get('/late', (_q, response, next) => {
      response.write('partial');
      next(new Error('SECRET after headers'));
    });
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
  }

  test('an invalid route is a 404 failure envelope with the route_not_found code', async () => {
    const response = await request(build()).get('/no/such/route');
    expect(response.status).toBe(404);
    expect(response.body).toEqual(failure('route_not_found', 'There is no such route.'));
  });

  test('a wrong method on a known path is also an invalid route', async () => {
    const response = await request(build()).delete('/echo');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('route_not_found');
  });

  test.each(['/throws', '/rejects', '/next-error'])(
    'an error from %s is a generic 500 envelope that leaks nothing',
    async (path) => {
      const response = await request(build()).get(path);
      expect(response.status).toBe(500);
      expect(response.body).toEqual(failure('internal_error', 'Something went wrong on the server. Please try again.'));
      expect(JSON.stringify(response.body)).not.toMatch(/SECRET|student_accounts|stack|\.ts:|node_modules/i);
      expect(response.headers['content-type']).toMatch(/json/);
    },
  );

  test('the real error is logged for the operator, with the method and path', async () => {
    await request(build()).get('/throws');
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(String(errorLog.mock.calls[0][0])).toContain('GET /throws');
    expect(String(errorLog.mock.calls[0][1])).toContain('SECRET: relation');
  });

  test('an HttpError keeps its own status, code and message', async () => {
    const response = await request(build()).get('/http-error');
    expect(response.status).toBe(409);
    expect(response.body).toEqual(failure('already_decided', 'Someone else already decided this.'));
    expect(errorLog).not.toHaveBeenCalled();
  });

  test('a malformed percent-encoded path is a 400, not a 500, and is not logged as a server error', async () => {
    const app = express();
    app.get('/item/:id', (request, response) => sendOk(response, { id: request.params.id }));
    app.use(notFoundHandler);
    app.use(errorHandler);
    const response = await request(app).get('/item/%E0%A4%A');
    expect(response.status).toBe(400);
    expect(response.body).toEqual(failure('invalid_input', 'The address of the request is not valid.'));
    expect(errorLog).not.toHaveBeenCalled();
  });

  test('an error carrying its own 4xx status is answered with that status, never a 500', async () => {
    const app = express();
    app.get('/teapot', (_q, _r, next) => next(Object.assign(new Error('x'), { status: 418 })));
    app.get('/gone', (_q, _r, next) => next(Object.assign(new Error('x'), { statusCode: 404 })));
    app.use(errorHandler);
    const teapot = await request(app).get('/teapot');
    expect(teapot.status).toBe(418);
    expect(teapot.body.error.code).toBe('invalid_input');
    const gone = await request(app).get('/gone');
    expect(gone.status).toBe(404);
    expect(gone.body.error.code).toBe('route_not_found');
    expect(errorLog).not.toHaveBeenCalled();
  });

  test('malformed JSON is a 400 invalid_json', async () => {
    const response = await request(build()).post('/echo').set('Content-Type', 'application/json').send('{"a":');
    expect(response.status).toBe(400);
    expect(response.body).toEqual(failure('invalid_json', 'The request body is not valid JSON.'));
    expect(errorLog).not.toHaveBeenCalled();
  });

  test('a body over the limit is a 413 payload_too_large', async () => {
    const response = await request(build())
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(5000) }));
    expect(response.status).toBe(413);
    expect(response.body).toEqual(failure('payload_too_large', 'The request body is too large.'));
  });

  test('an error after the response started is left to Express (no second body, no crash)', async () => {
    const response = await request(build())
      .get('/late')
      .buffer(true)
      .parse((res, callback) => {
        let data = '';
        res.on('data', (chunk: Buffer) => (data += chunk.toString()));
        res.on('end', () => callback(null, data));
        res.on('error', () => callback(null, data));
      });
    expect(String(response.body)).not.toContain('internal_error');
  });
});

describe('the handlers in the real app', () => {
  let errorLog: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => {
    errorLog.mockRestore();
  });

  const account = {
    role: 'student' as const,
    id: '2025-0000001',
    email: 'ana@students.nu-fairview.edu.ph',
    firstName: 'Ana',
    lastName: 'Cruz',
    passwordHashed: bcrypt.hashSync('Passw0rd1', 4),
    mustChangePassword: false,
    isActive: true,
  };

  function appWithRepo(repo = createMemoryAccountRepo([account])) {
    return createApp({
      auth: {
        service: createAuthService({ repo, rounds: 4 }),
        sessionSecret: 'test-secret-test-secret-test-secret-1',
        clientOrigin: 'http://localhost:5173',
      },
    });
  }

  test('an unknown route under the real app is the 404 envelope', async () => {
    const response = await request(appWithRepo()).get('/definitely/not/here');
    expect(response.status).toBe(404);
    expect(response.body).toEqual(failure('route_not_found', 'There is no such route.'));
  });

  test('the health-only app and the unconfigured app also use the envelope for unknown routes', async () => {
    const health = await request(healthOnlyApp).get('/nope');
    expect(health.status).toBe(404);
    expect(health.body.error.code).toBe('route_not_found');
    expect((await request(healthOnlyApp).get('/health')).body).toEqual({ status: 'ok' });
  });

  test('a malformed percent-encoded path under the real app is a 400 envelope', async () => {
    const response = await request(appWithRepo()).post('/staff/students/%E0%A4%A/reset-password');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_input');
    expect(errorLog).not.toHaveBeenCalled();
  });

  test('malformed JSON on login is a 400 invalid_json, not a 500 and not an HTML page', async () => {
    const response = await request(appWithRepo()).post('/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_json');
  });

  test('a body over 100 kb is a 413', async () => {
    const response = await request(appWithRepo())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@students.nu-fairview.edu.ph', password: 'x'.repeat(150_000) }));
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('payload_too_large');
  });

  test('a repository that throws is a 500 envelope with nothing from the database in it', async () => {
    const broken = createMemoryAccountRepo([account]);
    broken.findByEmail = async () => {
      throw new Error('SECRET connection to db.neon.tech refused');
    };
    const response = await request(appWithRepo(broken)).post('/auth/login').send({ email: account.email, password: 'Passw0rd1' });
    expect(response.status).toBe(500);
    expect(response.body).toEqual(failure('internal_error', 'Something went wrong on the server. Please try again.'));
    expect(JSON.stringify(response.body)).not.toContain('SECRET');
    expect(String(errorLog.mock.calls[0][0])).toContain('POST /auth/login');
  });

  test('every guard and failure in the app uses the envelope: no route answers with another JSON shape', async () => {
    const app = appWithRepo();
    const samples = [
      await request(app).get('/auth/me'), // not_authenticated
      await request(app).post('/auth/login').send({}), // invalid_credentials
      await request(app).post('/auth/change-password').send({}), // not_authenticated
      await request(app).get('/handbook'), // route_not_found here (no data wired)
      await request(app).get('/zzz'),
    ];
    for (const response of samples) {
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(Object.keys(response.body).sort()).toEqual(['error', 'ok']);
      expect(response.body.ok).toBe(false);
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.message).toBe('string');
    }
  });
});
