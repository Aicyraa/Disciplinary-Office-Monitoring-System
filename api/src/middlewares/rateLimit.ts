import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { sendError } from '../helpers/http.js';

/** The client's address as a rate-limit key (IPv6 addresses are grouped by /56). */
export const clientIpKey = (request: Request): string => ipKeyGenerator(request.ip ?? '');

/**
 * A fixed-window limit that answers 429 `too_many_attempts` in the standard envelope. Every attempt counts,
 * successes included, so a valid request cannot refund guesses.
 */
export function createRateLimiter({
  windowMs,
  limit,
  message,
  key = clientIpKey,
}: {
  windowMs: number;
  limit: number;
  message: string;
  key?: (request: Request) => string;
}): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: key,
    handler: (_request, response) => sendError(response, 429, 'too_many_attempts', message),
  });
}
