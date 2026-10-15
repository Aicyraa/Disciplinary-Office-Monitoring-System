/**
 * Reads `TRUST_PROXY`: the number of reverse proxies in front of the API, so that `req.ip` (used by the per-IP
 * limits of the public gate form) is the visitor's address and not the proxy's.
 *
 * Unset (a laptop) or unreadable returns undefined and Express keeps its default of not trusting any proxy.
 * Express's `true` ("trust every hop") is never produced: with it a visitor could forge `X-Forwarded-For` and
 * dodge the rate limit, so `true` is read as one proxy.
 */
export function trustProxyFromEnv(value: string | undefined): number | boolean | undefined {
  const text = value?.trim();
  if (!text) return undefined;
  if (text === 'false') return false;
  if (text === 'true') return 1;
  if (!/^\d{1,2}$/.test(text)) return undefined;
  const hops = Number(text);
  if (hops === 0) return false;
  return hops <= 5 ? hops : undefined;
}

export interface GateLimits {
  windowMs: number;
  /** Report submits per IP per window (SPEC 4.10: for example 5 per 10 minutes). */
  submits: number;
  /** Token and options requests per IP per window; looser than the submit limit. */
  tokens: number;
}

export const DEFAULT_GATE_LIMITS: GateLimits = { windowMs: 10 * 60_000, submits: 5, tokens: 30 };

/** A report is a few short fields; anything bigger than this is not one. */
export const MAX_REPORT_BODY_CHARACTERS = 8_000;
