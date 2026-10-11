import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { Passport } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import type { AccountRole, AuthUser } from '../../../shared/types.js';
import { requireAuth, requireStaff } from './guards.js';
import { STUDENT_ID_PATTERN } from './policy.js';
import type { AuthService } from './service.js';

export interface LoginRateLimitOptions {
  windowMs: number;
  /** Failed attempts allowed per IP in the window. */
  limit: number;
}

export interface AuthRouterOptions {
  service: AuthService;
  loginRateLimit?: LoginRateLimitOptions;
}

const GENERIC_LOGIN_ERROR = { error: 'invalid_credentials', message: 'Invalid email or password.' };

const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export function createAuthRouter({ service, loginRateLimit = { windowMs: 15 * 60 * 1000, limit: 10 } }: AuthRouterOptions): Router {
  const authenticator = new Passport();

  authenticator.use(
    new LocalStrategy({ usernameField: 'email', passwordField: 'password' }, (email, password, done) => {
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

  const loginLimiter = rateLimit({
    windowMs: loginRateLimit.windowMs,
    limit: loginRateLimit.limit,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { error: 'too_many_attempts', message: 'Too many sign-in attempts. Try again later.' },
  });

  const router = Router();
  router.use(authenticator.initialize());
  router.use(authenticator.session());

  router.post('/auth/login', loginLimiter, (request, response, next) => {
    authenticator.authenticate('local', (error: unknown, user: AuthUser | false) => {
      if (error) return next(error);
      if (!user) return response.status(401).json(GENERIC_LOGIN_ERROR);
      // req.login regenerates the session id (no session fixation).
      request.logIn(user, (loginError) => {
        if (loginError) return next(loginError);
        response.status(200).json({ user });
      });
    })(request, response, next);
  });

  router.post('/auth/logout', (request, response, next) => {
    request.logout((error) => {
      if (error) return next(error);
      request.session.destroy(() => {
        response.clearCookie('sdo.sid');
        response.status(204).end();
      });
    });
  });

  router.get('/auth/me', requireAuth, (request, response) => {
    response.status(200).json({ user: request.user });
  });

  router.post('/auth/change-password', requireAuth, async (request, response, next) => {
    const currentPassword = asString(request.body?.currentPassword);
    const newPassword = asString(request.body?.newPassword);
    if (currentPassword === null || newPassword === null) {
      response.status(400).json({ error: 'invalid_request', message: 'currentPassword and newPassword are required.' });
      return;
    }
    const user = request.user as AuthUser;
    const result = await service.changePassword(user.role, user.id, currentPassword, newPassword);
    if (!result.ok) {
      response.status(result.code === 'not_found' ? 401 : 400).json({ error: result.code, message: result.message });
      return;
    }
    // Refresh the session copy so mustChangePassword clears at once.
    request.logIn(result.user, (loginError) => {
      if (loginError) return next(loginError);
      response.status(200).json({ user: result.user });
    });
  });

  // Staff only (SPEC 4.8, FEATURE-RULES 3.1). The temp password is returned once and never stored in clear text.
  router.post('/staff/students/:studentId/reset-password', ...requireStaff, async (request, response) => {
    const studentId = String(request.params.studentId);
    if (!STUDENT_ID_PATTERN.test(studentId)) {
      response.status(400).json({ error: 'invalid_student_id' });
      return;
    }
    const result = await service.resetStudentPassword(studentId);
    if (!result.ok) {
      response.status(404).json({ error: 'not_found' });
      return;
    }
    response.status(200).json({ tempPassword: result.tempPassword });
  });

  return router;
}
