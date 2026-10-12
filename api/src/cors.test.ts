import { describe, expect, test } from 'vitest';
import { LOCAL_PREVIEW_PORT, allowedClientOrigins } from './cors.js';

describe('allowedClientOrigins', () => {
  test('the configured origin is always allowed', () => {
    expect(allowedClientOrigins('https://sdo.example.edu', { loopbackAliases: false })).toEqual(new Set(['https://sdo.example.edu']));
  });

  test('normalizes a trailing slash and case', () => {
    expect(allowedClientOrigins('HTTP://Localhost:5173/', { loopbackAliases: false })).toEqual(new Set(['http://localhost:5173']));
  });

  test('in development a loopback origin also allows its loopback aliases on the same port', () => {
    const allowed = allowedClientOrigins('http://localhost:5173', { loopbackAliases: true });
    for (const host of ['localhost', '127.0.0.1', '[::1]']) expect(allowed).toContain(`http://${host}:5173`);
    expect(allowedClientOrigins('http://127.0.0.1:5173', { loopbackAliases: true })).toContain('http://localhost:5173');
  });

  test('in development the local preview server of the built client (port 4173) is allowed too', () => {
    expect(LOCAL_PREVIEW_PORT).toBe(4173);
    const allowed = allowedClientOrigins('http://localhost:5173', { loopbackAliases: true });
    for (const host of ['localhost', '127.0.0.1', '[::1]']) expect(allowed).toContain(`http://${host}:4173`);
    // 3 hosts x (dev port + preview port)
    expect(allowed.size).toBe(6);
  });

  test('aliases and the preview port never apply when disabled (production)', () => {
    expect(allowedClientOrigins('http://localhost:5173', { loopbackAliases: false })).toEqual(new Set(['http://localhost:5173']));
  });

  test('a non-loopback origin gets no aliases and no preview port even in development', () => {
    expect(allowedClientOrigins('https://sdo.example.edu', { loopbackAliases: true })).toEqual(new Set(['https://sdo.example.edu']));
  });

  test('never widens to another port, another scheme or another host', () => {
    const allowed = allowedClientOrigins('http://localhost:5173', { loopbackAliases: true });
    expect(allowed.has('http://localhost:5174')).toBe(false);
    expect(allowed.has('http://localhost:3000')).toBe(false);
    expect(allowed.has('https://localhost:5173')).toBe(false);
    expect(allowed.has('https://localhost:4173')).toBe(false);
    expect(allowed.has('http://evil.example:5173')).toBe(false);
    expect(allowed.has('http://evil.example:4173')).toBe(false);
  });

  test('a loopback origin without a port still gets the preview port', () => {
    const allowed = allowedClientOrigins('http://localhost', { loopbackAliases: true });
    expect(allowed).toContain('http://localhost');
    expect(allowed).toContain('http://localhost:4173');
  });

  test.each(['not a url', 'null', ''])('an unparsable origin (%j) allows nothing', (value) => {
    expect(allowedClientOrigins(value, { loopbackAliases: true })).toEqual(new Set());
  });
});
