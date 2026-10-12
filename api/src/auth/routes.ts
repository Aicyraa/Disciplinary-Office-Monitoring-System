import { Router } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { Passport } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import type { AccountRole, AuthUser } from '@shared/types.js';
import { sendError, sendOk } from '../http.js';
import { requireAuth, requireStaff } from './guards.js';
import { STUDENT_ID_PATTERN } from './policy.js';
import type { AuthService } from './service.js';

export interface LoginRateLimitOptions {
  windowMs: number;
  /** Attempts allowed per IP + email in the window; the per-IP cap is 10x this. */
  limit: number;
}

export interface AuthRouterOptions {
  service: AuthService;
  loginRateLimit?: LoginRateLimitOptions;
}



const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function createAuthRouter({ service, loginRateLimit = { windowMs: 15 * 60 * 1000, limit: 10 } }: AuthRouterOptions): Router {
  const authenticator = new Passport();

  authenticator.use(
    new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, (email, password, done) => {
      // JSON can carry objects or arrays here; anything but strings is just a failed login.
      if (typeof email !== 'string' || typeof password !== 'string') return done(null, false);
      service.login(email, password).then(
        (user) => done(null, user ?? false),
        (error: unknown) => done(error),
      );
    }),
  );
  authenticator.serializeUser((user, done) => done(null, `${user.role}:${user.id}`));
  authenticator.deserializeUser((key: string, done) => {
    const [role, ...rest] = key.split(':');
    if (role !== 'student' && role !== 'staff') return done(null, false);
    service.getUser(role as AccountRole, rest.join(':')).then(
      (user) => done(null, user ?? false),
      (error: unknown) => done(error),
    );
  });

  // Every attempt counts (successes included), so a valid own-account login cannot refund guesses at another
  // account. Two limits: per IP + email (stops guessing one account) and a looser per-IP cap (stops
  // spraying many emails from one address).
  const limiterBase = {
    windowMs: loginRateLimit.windowMs,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request: unknown, response: Parameters<typeof sendError>[0]) =>
      sendError(response, 429, 'too_many_attempts', 'Too many sign-in attempts. Try again later.'),
  } as const;
  const perAccountLimiter = rateLimit({
    ...limiterBase,
    limit: loginRateLimit.limit,
    keyGenerator: (request) => {
      const email = asString(request.body?.email);
      return `${ipKeyGenerator(request.ip ?? '')}|${email === null ? '' : email.trim().toLowerCase()}`;
    },
  });
  const perIpLimiter = rateLimit({
    ...limiterBase,
    limit: loginRateLimit.limit * 10,
    keyGenerator: (request) => ipKeyGenerator(request.ip ?? ''),
  });

  const router = Router();
  router.use(authenticator.initialize());
  router.use(authenticator.session());

  router.post('/auth/login', perIpLimiter, perAccountLimiter, (request, response, next) => {
    authenticator.authenticate('local', (error: unknown, user: AuthUser | false) => {
      if (error) return next(error);
      // One message for every failure (unknown email, wrong password, bad domain, inactive, malformed).
      if (!user) return sendError(response, 401, 'invalid_credentials', 'Invalid email or password.');
      // req.login regenerates the session id (no session fixation).
      request.logIn(user, (loginError) => {
        if (loginError) return next(loginError);
        sendOk(response, { user });
      });
    })(request, response, next);
  });

  router.post('/auth/logout', (request, response, next) => {
    request.logout((error) => {
      if (error) return next(error);
      request.session.destroy(() => {
        response.clearCookie('sdo.sid');
        sendOk(response, null);
      });
    });
  });

  router.get('/auth/me', requireAuth, (request, response) => {
    sendOk(response, { user: request.user });
  });

  router.post('/auth/change-password', requireAuth, async (request, response, next) => {
    const currentPassword = asString(request.body?.currentPassword);
    const newPassword = asString(request.body?.newPassword);
    if (currentPassword === null || newPassword === null) {
      sendError(response, 400, 'invalid_input', 'currentPassword and newPassword are required.');
      return;
    }
    const user = request.user as AuthUser;
    const result = await service.changePassword(user.role, user.id, currentPassword, newPassword);
    if (!result.ok) {
      if (result.code === 'not_found') sendError(response, 401, 'not_authenticated', 'Sign in to continue.');
      else sendError(response, 400, result.code, result.message);
      return;
    }
    // Refresh the session copy so mustChangePassword clears at once.
    request.logIn(result.user, (loginError) => {
      if (loginError) return next(loginError);
      sendOk(response, { user: result.user });
    });
  });

  // Staff only (SPEC 4.8, FEATURE-RULES 3.1). The temp password is returned once and never stored in clear text.
  router.post('/staff/students/:studentId/reset-password', ...requireStaff, async (request, response) => {
    const studentId = String(request.params.studentId);
    if (!STUDENT_ID_PATTERN.test(studentId)) {
      sendError(response, 400, 'invalid_input', 'Student ID must look like 2025-1234567.');
      return;
    }
    const result = await service.resetStudentPassword(studentId);
    if (!result.ok) {
      sendError(response, 404, 'student_not_found', 'No student has that ID.');
      return;
    }
    response.set('Cache-Control', 'no-store');
    sendOk(response, { tempPassword: result.tempPassword });
  });

  return router;
}
