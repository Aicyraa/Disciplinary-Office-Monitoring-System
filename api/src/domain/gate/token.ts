import { createHmac, timingSafeEqual } from 'node:crypto';

/** A form submitted sooner than this after it opened was filled by a script, not a person (SPEC decision 12). */
export const MIN_AGE_MS = 3_000;
/** A form older than this is stale. */
export const MAX_AGE_MS = 30 * 60_000;

const sign = (secret: string, stamp: string): string => createHmac('sha256', secret).update(`gate-form:${stamp}`).digest('hex');

/** Stateless: `<unix ms>.<hmac>`. Nothing is stored; the signature proves the API issued the timestamp. */
export function signFormToken(secret: string, nowMs: number): string {
  const stamp = String(nowMs);
  return `${stamp}.${sign(secret, stamp)}`;
}

/**
 * The one place the "is this a person?" decision lives, so a captcha can be added later without touching the
 * form flow. True only for a well-formed, untampered token between 3 seconds and 30 minutes old. Callers answer
 * every failure with the same generic error, so which check failed is never revealed.
 */
export function verifyHuman({ token, secret, nowMs }: { token: unknown; secret: string; nowMs: number }): boolean {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [stamp, signature] = parts;
  if (!/^\d{10,16}$/.test(stamp) || !/^[0-9a-f]{64}$/.test(signature)) return false;

  const expected = Buffer.from(sign(secret, stamp), 'hex');
  const given = Buffer.from(signature, 'hex');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;

  const age = nowMs - Number(stamp);
  return age >= MIN_AGE_MS && age <= MAX_AGE_MS;
}
