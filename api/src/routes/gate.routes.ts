import { Router } from 'express';
import { DEFAULT_GATE_LIMITS, type GateLimits } from '../config/gate.js';
import { createGateController } from '../controllers/gate.controller.js';
import { requireFormToken } from '../middlewares/formToken.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import type { GateService } from '../services/gate.service.js';
import type { GateOptionsReader } from '../repositories/gate/types.js';

export interface GateRouterOptions {
  service: GateService;
  options: GateOptionsReader;
  /** HMAC key for the form-timing token (the same SESSION_SECRET the sessions use). */
  secret: string;
  now?: () => Date;
  limits?: GateLimits;
}

/**
 * The public gate form's API (SPEC 4.10, decision 12): no session. Protection is, in order: a per-IP rate limit
 * (counted for every attempt, failed or not), the form-timing token, field validation and a body-size limit
 * (the last two in the controller). Every refusal gets the same answer.
 */
export function createGateRouter({
  service,
  options,
  secret,
  now = () => new Date(),
  limits = DEFAULT_GATE_LIMITS,
}: GateRouterOptions): Router {
  const message = 'Too many requests. Please wait a few minutes and try again.';
  const submitLimiter = createRateLimiter({ windowMs: limits.windowMs, limit: limits.submits, message });
  const readLimiter = createRateLimiter({ windowMs: limits.windowMs, limit: limits.tokens, message });
  const gate = createGateController({ service, options, secret, now });

  const router = Router();
  router.get('/public/gate-form-token', readLimiter, gate.token);
  router.get('/public/gate-form-options', readLimiter, gate.formOptions);
  router.post('/public/gate-reports', submitLimiter, requireFormToken({ secret, now }), gate.submit);

  return router;
}
