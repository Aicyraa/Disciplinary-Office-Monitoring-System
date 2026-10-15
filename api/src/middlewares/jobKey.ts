import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { sendError } from '../helpers/http.js';

/** The header a scheduled job (Power Automate) sends its key in. */
export const JOB_KEY_HEADER = 'X-SDO-Job-Key';
/** A shorter configured key is treated as not configured, so a placeholder never opens the route. */
export const MIN_JOB_KEY_LENGTH = 32;

/** Compares two secrets in constant time (hashing first makes the lengths equal). */
function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/**
 * Lets a request through only with the configured job key (`PA_JOB_KEY`) in `X-SDO-Job-Key`. No session is read
 * or needed. `expected` is called per request so a key change in the environment applies without a restart.
 */
export function requireJobKey(expected: () => string | undefined): RequestHandler {
  return (request, response, next) => {
    const key = expected();
    if (!key || key.length < MIN_JOB_KEY_LENGTH) {
      return sendError(response, 503, 'server_not_configured', 'The scheduled job key is not configured on the server.');
    }
    const given = request.get(JOB_KEY_HEADER);
    if (!given || !sameSecret(given, key)) {
      return sendError(response, 401, 'not_authenticated', 'A valid job key is required.');
    }
    next();
  };
}
