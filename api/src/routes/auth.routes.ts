import { Router } from 'express';
import { createAuthenticator } from '../config/passport.js';
import { createAuthController } from '../controllers/auth.controller.js';
import { requireAuth, requireStaff } from '../middlewares/auth.js';
import { clientIpKey, createRateLimiter } from '../middlewares/rateLimit.js';
import type { AuthService } from '../services/auth.service.js';
import { asString } from '../validators/auth.validators.js';

export interface LoginRateLimitOptions {
  windowMs: number;
  /** Attempts allowed per IP + email in the window; the per-IP cap is 10x this. */
  limit: number;
}

export interface AuthRouterOptions {
  service: AuthService;
  loginRateLimit?: LoginRateLimitOptions;
  /** See AuthControllerDeps.onPasswordReset. */
  onPasswordReset?: (studentId: string) => Promise<void>;
}

/** Sign-in and account routes (SPEC 4.8). Wiring only. */
export function createAuthRouter({
  service,
  loginRateLimit = { windowMs: 15 * 60 * 1000, limit: 10 },
  onPasswordReset,
}: AuthRouterOptions): Router {
  const authenticator = createAuthenticator(service);
  const auth = createAuthController({ service, authenticator, onPasswordReset });

  // Every attempt counts (successes included), so a valid own-account login cannot refund guesses at another
  // account. Two limits: per IP + email (stops guessing one account) and a looser per-IP cap (stops
  // spraying many emails from one address).
  const message = 'Too many sign-in attempts. Try again later.';
  const perAccountLimiter = createRateLimiter({
    windowMs: loginRateLimit.windowMs,
    limit: loginRateLimit.limit,
    message,
    key: (request) => {
      const email = asString(request.body?.email);
      return `${clientIpKey(request)}|${email === null ? '' : email.trim().toLowerCase()}`;
    },
  });
  const perIpLimiter = createRateLimiter({
    windowMs: loginRateLimit.windowMs,
    limit: loginRateLimit.limit * 10,
    message,
  });

  const router = Router();
  router.use(authenticator.initialize());
  router.use(authenticator.session());

  router.post('/auth/login', perIpLimiter, perAccountLimiter, auth.login);
  router.post('/auth/logout', auth.logout);
  router.get('/auth/me', requireAuth, auth.me);
  router.post('/auth/change-password', requireAuth, auth.changePassword);
  // Staff only (SPEC 4.8, FEATURE-RULES 3.1).
  router.post('/staff/students/:studentId/reset-password', ...requireStaff, auth.resetStudentPassword);

  return router;
}
