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
