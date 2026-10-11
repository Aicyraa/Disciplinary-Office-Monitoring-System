import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defaultMessage, http, setSessionEndedHandler, toApiError } from './api';

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

  test('toApiError keeps the server message and falls back by status', async () => {
    http.defaults.adapter = respondWith(403, { error: 'forbidden' });
    const error = await http.get('/me/cases').catch((caught: unknown) => toApiError(caught));
    expect(error).toMatchObject({ status: 403, code: 'forbidden', message: 'You do not have access to this page.' });
    http.defaults.adapter = respondWith(400, { error: 'invalid_term', message: 'Pick a term.' });
    const withMessage = await http.get('/me/clearance').catch((caught: unknown) => toApiError(caught));
    expect(withMessage).toMatchObject({ status: 400, message: 'Pick a term.' });
  });
});
