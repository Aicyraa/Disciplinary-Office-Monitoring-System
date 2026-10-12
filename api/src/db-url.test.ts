import { describe, expect, test } from 'vitest';
import { withExplicitSsl } from './db-url.js';

const base = 'postgresql://user:pw@ep-example.neon.tech/db';

describe('withExplicitSsl', () => {
  test.each(['prefer', 'require', 'verify-ca'])('sslmode=%s becomes verify-full', (mode) => {
    const result = new URL(withExplicitSsl(`${base}?sslmode=${mode}&channel_binding=require`));
    expect(result.searchParams.get('sslmode')).toBe('verify-full');
    expect(result.searchParams.get('channel_binding')).toBe('require');
    expect(result.username).toBe('user');
    expect(result.hostname).toBe('ep-example.neon.tech');
  });

  test('verify-full, disable and a missing sslmode are untouched', () => {
    for (const url of [`${base}?sslmode=verify-full`, `${base}?sslmode=disable`, base]) {
      expect(withExplicitSsl(url)).toBe(url);
    }
  });

  test('uselibpqcompat opts out of the rewrite', () => {
    const url = `${base}?sslmode=require&uselibpqcompat=true`;
    expect(withExplicitSsl(url)).toBe(url);
  });

  test('something that is not a URL is returned as it came', () => {
    expect(withExplicitSsl('not a url')).toBe('not a url');
  });
});
