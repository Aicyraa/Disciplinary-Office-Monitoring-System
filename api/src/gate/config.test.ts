import { describe, expect, test } from 'vitest';
import { trustProxyFromEnv } from './config.js';

describe('trustProxyFromEnv (TRUST_PROXY)', () => {
  test('unset or blank means "no proxy" (the setting stays untouched)', () => {
    expect(trustProxyFromEnv(undefined)).toBeUndefined();
    expect(trustProxyFromEnv('')).toBeUndefined();
    expect(trustProxyFromEnv('   ')).toBeUndefined();
  });

  test('a number is how many proxies sit in front of the API', () => {
    expect(trustProxyFromEnv('1')).toBe(1);
    expect(trustProxyFromEnv(' 2 ')).toBe(2);
    expect(trustProxyFromEnv('0')).toBe(false);
  });

  test('true and false are accepted, anything else is ignored rather than trusted', () => {
    expect(trustProxyFromEnv('false')).toBe(false);
    expect(trustProxyFromEnv('true')).toBe(1); // never "trust everything": one proxy is the safe reading
    expect(trustProxyFromEnv('loopback')).toBeUndefined();
    expect(trustProxyFromEnv('-1')).toBeUndefined();
    expect(trustProxyFromEnv('99')).toBeUndefined();
    expect(trustProxyFromEnv('1.5')).toBeUndefined();
  });
});
