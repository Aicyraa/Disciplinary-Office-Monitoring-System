import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { api, defaultMessage, http, setSessionEndedHandler, toApiError } from './api';

describe('defaultMessage', () => {
  test.each([
    [401, /session has ended/i],
    [403, /do not have access/i],
    [404, /could not find/i],
    [429, /too many requests/i],
    [500, /something went wrong/i],
  ])('status %i', (status, pattern) => {
    expect(defaultMessage(status)).toMatch(pattern);
  });
});

/** An adapter that answers every request with the given status, so no network is needed. */
function respondWith(status: number, data: unknown = {}): AxiosAdapter {
  return (config: InternalAxiosRequestConfig) =>
    Promise.reject(
      new AxiosError('failed', String(status), config, null, {
        status,
        statusText: String(status),
        headers: {},
        config,
        data,
      }),
    );
}

describe('session-ended handling', () => {
  const originalAdapter = http.defaults.adapter;
  const handler = vi.fn();

  beforeEach(() => {
    handler.mockClear();
    setSessionEndedHandler(handler);
  });

  afterEach(() => {
    setSessionEndedHandler(null);
    http.defaults.adapter = originalAdapter;
  });

  test('a 401 on a data request signals that the session ended', async () => {
    http.defaults.adapter = respondWith(401);
    await expect(http.get('/me/cases')).rejects.toBeTruthy();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test.each(['/auth/login', '/auth/me'])('a 401 on %s is normal and does not', async (path) => {
    http.defaults.adapter = respondWith(401);
    await expect(http.get(path)).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });

  test('a 404 does not end the session', async () => {
    http.defaults.adapter = respondWith(404);
    await expect(http.get('/me/cases/9')).rejects.toBeTruthy();
    expect(handler).not.toHaveBeenCalled();
  });

  test('toApiError reads the shared failure envelope and falls back by status for any other body', async () => {
    http.defaults.adapter = respondWith(403, { ok: false, error: { code: 'forbidden', message: 'You do not have access to this.' } });
    const error = await http.get('/me/cases').catch((caught: unknown) => toApiError(caught));
    expect(error).toMatchObject({ status: 403, code: 'forbidden', message: 'You do not have access to this.' });

    http.defaults.adapter = respondWith(403, '<html>Forbidden</html>');
    const notEnvelope = await http.get('/me/cases').catch((caught: unknown) => toApiError(caught));
    expect(notEnvelope).toMatchObject({ status: 403, code: null, message: 'You do not have access to this page.' });
  });
});

/** An adapter that resolves with a 2xx response carrying `body`. */
function succeedWith(body: unknown, status = 200): AxiosAdapter {
  return async (config: InternalAxiosRequestConfig) => ({ status, statusText: 'OK', headers: {}, config, data: body });
}

describe('the shared response envelope (one success type, one failure type)', () => {
  const originalAdapter = http.defaults.adapter;
  afterEach(() => {
    http.defaults.adapter = originalAdapter;
  });

  test('a success envelope is unwrapped to its data', async () => {
    http.defaults.adapter = succeedWith({ ok: true, data: { user: { id: 'E001' } } });
    await expect(api.me()).resolves.toEqual({ user: { id: 'E001' } });
  });

  test('data may be null (logout, delete)', async () => {
    http.defaults.adapter = succeedWith({ ok: true, data: null });
    await expect(api.logout()).resolves.toBeNull();
  });

  test('a failure envelope becomes an ApiError with the code and message', async () => {
    http.defaults.adapter = respondWith(409, {
      ok: false,
      error: { code: 'already_decided', message: 'This report was already validated or rejected.' },
    });
    await expect(api.validateSubmission('11111111-1111-4111-8111-111111111111')).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      code: 'already_decided',
      message: 'This report was already validated or rejected.',
    });
  });

  test.each([
    ['an HTML page from a proxy', '<html>Bad gateway</html>'],
    ['the old unwrapped shape', { user: { id: 'E001' } }],
    ['a failure shaped body with a 200', { ok: false }],
    ['null', null],
  ])('a 200 that is not the envelope (%s) is a failure, never data', async (_label, body) => {
    http.defaults.adapter = succeedWith(body);
    await expect(api.me()).rejects.toMatchObject({ name: 'ApiError', status: 200, code: null });
  });

  test('a network failure keeps status 0 and no code', async () => {
    http.defaults.adapter = () => Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK'));
    await expect(api.me()).rejects.toMatchObject({ status: 0, code: null });
  });
});
