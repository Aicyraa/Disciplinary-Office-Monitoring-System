import { describe, expect, test } from 'vitest';
import { allowedClientOrigins } from './cors.js';

describe('allowedClientOrigins', () => {
  test('the configured origin is always allowed', () => {
    expect(allowedClientOrigins('https://sdo.example.edu', { loopbackAliases: false })).toEqual(new Set(['https://sdo.example.edu']));
  });

  test('normalizes a trailing slash and case', () => {
    expect(allowedClientOrigins('HTTP://Localhost:5173/', { loopbackAliases: false })).toEqual(new Set(['http://localhost:5173']));
  });

  test('in development a loopback origin also allows its loopback aliases on the same port', () => {
    expect(allowedClientOrigins('http://localhost:5173', { loopbackAliases: true })).toEqual(
      new Set(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173']),
    );
    expect(allowedClientOrigins('http://127.0.0.1:5173', { loopbackAliases: true })).toContain('http://localhost:5173');
  });

  test('aliases never apply when disabled (production)', () => {
    expect(allowedClientOrigins('http://localhost:5173', { loopbackAliases: false })).toEqual(new Set(['http://localhost:5173']));
  });

  test('a non-loopback origin gets no aliases even in development', () => {
    expect(allowedClientOrigins('https://sdo.example.edu', { loopbackAliases: true })).toEqual(new Set(['https://sdo.example.edu']));
  });

  test('never widens to another port or scheme', () => {
    const allowed = allowedClientOrigins('http://localhost:5173', { loopbackAliases: true });
    expect(allowed.has('http://localhost:5174')).toBe(false);
    expect(allowed.has('https://localhost:5173')).toBe(false);
    expect(allowed.has('http://evil.example:5173')).toBe(false);
  });

  test('an unparsable origin falls back to itself only', () => {
    expect(allowedClientOrigins('not a url', { loopbackAliases: true })).toEqual(new Set(['not a url']));
  });
});
