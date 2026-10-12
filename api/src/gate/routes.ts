import { Router, type Request, type Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { PUBLIC_REJECTION, sendError, sendOk } from '../http.js';
import type { GateService } from './service.js';
import { signFormToken, verifyHuman } from './token.js';
import type { GateOptionsReader } from './types.js';
import { parseReport } from './validate.js';

export interface GateLimits {
  windowMs: number;
  /** Report submits per IP per window (SPEC 4.10: for example 5 per 10 minutes). */
  submits: number;
  /** Token and options requests per IP per window; looser than the submit limit. */
  tokens: number;
}

export interface GateRouterOptions {
  service: GateService;
  options: GateOptionsReader;
  /** HMAC key for the form-timing token (the same SESSION_SECRET the sessions use). */
  secret: string;
  now?: () => Date;
  limits?: GateLimits;
}

export const DEFAULT_GATE_LIMITS: GateLimits = { windowMs: 10 * 60_000, submits: 5, tokens: 30 };

/** The one answer for every refusal of a report, so a bot learns nothing about which check failed. */
export const GENERIC_REJECTION = PUBLIC_REJECTION;

/** A report is a few short fields; anything bigger than this is not one. */
const MAX_BODY_CHARACTERS = 8_000;

const refuse = (response: Response): void => sendError(response, 400, 'invalid_input', GENERIC_REJECTION);

/**
 * The public gate form's API (SPEC 4.10, decision 12): no session. Protection is, in order: a per-IP rate limit
 * (counted for every attempt, failed or not), the form-timing token behind `verifyHuman()`, field validation and a
 * body-size limit. Every refusal gets the same answer.
 */
export function createGateRouter({
  service,
  options,
  secret,
  now = () => new Date(),
  limits = DEFAULT_GATE_LIMITS,
}: GateRouterOptions): Router {
  const base = {
    windowMs: limits.windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (request: Request) => ipKeyGenerator(request.ip ?? ''),
    handler: (_request: unknown, response: Response) =>
      sendError(response, 429, 'too_many_attempts', 'Too many requests. Please wait a few minutes and try again.'),
  } as const;
  const submitLimiter = rateLimit({ ...base, limit: limits.submits });
  const readLimiter = rateLimit({ ...base, limit: limits.tokens });

  const router = Router();

  router.get('/public/gate-form-token', readLimiter, (_request, response) => {
    sendOk(response, { token: signFormToken(secret, now().getTime()) });
  });

  router.get('/public/gate-form-options', readLimiter, async (_request, response) => {
    sendOk(response, await options.listOptions());
  });

  router.post('/public/gate-reports', submitLimiter, async (request, response) => {
    const body: unknown = request.body;
    const token = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).token : undefined;
    if (!verifyHuman({ token, secret, nowMs: now().getTime() })) return refuse(response);
    if (JSON.stringify(body ?? null).length > MAX_BODY_CHARACTERS) return refuse(response);

    // Only the five report fields are read; nothing else in the body can reach the database.
    const parsed = parseReport(body);
    if (!parsed.ok) return refuse(response);

    const result = await service.submit(parsed.value);
    if (!result.ok) return refuse(response);
    sendOk(response, { reference: result.reference, code: result.code, duplicate: result.duplicate }, result.duplicate ? 200 : 201);
  });

  return router;
}
