import { describe, expect, test } from 'vitest';
import { MAX_AGE_MS, MIN_AGE_MS, signFormToken, verifyHuman } from '../../../src/domain/gate/token.js';

const SECRET = 'test-secret-test-secret-test-secret-1';
const T0 = Date.parse('2026-10-12T02:00:00Z');

describe('verifyHuman (form-timing token, SPEC decision 12)', () => {
  const token = signFormToken(SECRET, T0);

  test('accepts a token between 3 seconds and 30 minutes old', () => {
    expect(MIN_AGE_MS).toBe(3_000);
    expect(MAX_AGE_MS).toBe(30 * 60_000);
    expect(verifyHuman({ token, secret: SECRET, nowMs: T0 + 3_000 })).toBe(true);
    expect(verifyHuman({ token, secret: SECRET, nowMs: T0 + 60_000 })).toBe(true);
    expect(verifyHuman({ token, secret: SECRET, nowMs: T0 + MAX_AGE_MS })).toBe(true);
  });

  test('rejects a token that is too fresh', () => {
    expect(verifyHuman({ token, secret: SECRET, nowMs: T0 })).toBe(false);
    expect(verifyHuman({ token, secret: SECRET, nowMs: T0 + 2_999 })).toBe(false);
  });

  test('rejects an expired token', () => {
    expect(verifyHuman({ token, secret: SECRET, nowMs: T0 + MAX_AGE_MS + 1 })).toBe(false);
  });

  test('rejects a token from the future', () => {
    expect(verifyHuman({ token: signFormToken(SECRET, T0 + 600_000), secret: SECRET, nowMs: T0 + 10_000 })).toBe(false);
  });

  test('rejects missing, empty and malformed tokens', () => {
    for (const bad of [undefined, null, '', 'abc', '123.', '.abc', 'a.b.c', 42, {}, ['x']]) {
      expect(verifyHuman({ token: bad, secret: SECRET, nowMs: T0 + 60_000 })).toBe(false);
    }
  });

  test('rejects a tampered timestamp or signature', () => {
    const [stamp, signature] = token.split('.');
    const older = `${Number(stamp) - 600_000}.${signature}`;
    expect(verifyHuman({ token: older, secret: SECRET, nowMs: T0 + 60_000 })).toBe(false);
    const flipped = `${stamp}.${signature.slice(0, -1)}${signature.endsWith('0') ? '1' : '0'}`;
    expect(verifyHuman({ token: flipped, secret: SECRET, nowMs: T0 + 60_000 })).toBe(false);
  });

  test('rejects a token signed with another secret', () => {
    const other = signFormToken('another-secret-another-secret-another-1', T0);
    expect(verifyHuman({ token: other, secret: SECRET, nowMs: T0 + 60_000 })).toBe(false);
  });
});
