import type { RequestHandler } from 'express';
import type { AccountRole } from '../../../shared/types.js';

declare global {
  // Passport's documented way to type req.user; a namespace is the only form that merges.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // Passport stores the signed-in AuthUser on req.user.
    interface User {
      role: AccountRole;
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      mustChangePassword: boolean;
    }
  }
}

/** 401 unless a session is signed in. Allowed while a password change is still pending. */
export const requireAuth: RequestHandler = (request, response, next) => {
  if (!request.user) {
    response.status(401).json({ error: 'not_authenticated' });
    return;
  }
  next();
};

/** 403 when the account must set a new password first (staff reset or temp password). */
export const requirePasswordChanged: RequestHandler = (request, response, next) => {
  if (request.user?.mustChangePassword) {
    response.status(403).json({ error: 'password_change_required' });
    return;
  }
  next();
};

/** 403 unless the signed-in user has the role. Chain after requireAuth. */
export function requireRole(role: AccountRole): RequestHandler {
  return (request, response, next) => {
    if (request.user?.role !== role) {
      response.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  };
}

/** Standard guard stack for feature routes: signed in, password settled, right role. */
export const requireStaff: RequestHandler[] = [requireAuth, requirePasswordChanged, requireRole('staff')];
export const requireStudent: RequestHandler[] = [requireAuth, requirePasswordChanged, requireRole('student')];
