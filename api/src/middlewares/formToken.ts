import type { RequestHandler } from 'express';
import { verifyHuman } from '../domain/gate/token.js';
import { PUBLIC_REJECTION, sendError } from '../helpers/http.js';

/**
 * SPEC 4.10: the gate form's form-timing token (no captcha). A missing, forged, too-fast or expired token gets
 * the same generic refusal as every other check, so a bot learns nothing about which one failed.
 */
export function requireFormToken({ secret, now }: { secret: string; now: () => Date }): RequestHandler {
  return (request, response, next) => {
    const body: unknown = request.body;
    const token = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).token : undefined;
    if (!verifyHuman({ token, secret, nowMs: now().getTime() })) {
      return sendError(response, 400, 'invalid_input', PUBLIC_REJECTION);
    }
    next();
  };
}
