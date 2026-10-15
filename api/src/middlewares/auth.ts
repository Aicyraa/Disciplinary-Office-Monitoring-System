import type { RequestHandler } from 'express';
import { sendError } from '../helpers/http.js';
import type { AccountRole } from '@shared/types.js';

/** 401 unless a session is signed in. Allowed while a password change is still pending. */
export const requireAuth: RequestHandler = (request, response, next) => {
  if (!request.user) {
    sendError(response, 401, 'not_authenticated', 'Sign in to continue.');
    return;
  }
  next();
};

/** 403 when the account must set a new password first (staff reset or temp password). */
export const requirePasswordChanged: RequestHandler = (request, response, next) => {
  if (request.user?.mustChangePassword) {
    sendError(response, 403, 'password_change_required', 'You must set a new password before you can continue.');
    return;
  }
  next();
};

/** 403 unless the signed-in user has the role. Chain after requireAuth. */
export function requireRole(role: AccountRole): RequestHandler {
  return (request, response, next) => {
    if (request.user?.role !== role) {
      sendError(response, 403, 'forbidden', 'You do not have access to this.');
      return;
    }
    next();
  };
}

/** Standard guard stack for feature routes: signed in, password settled, right role. */
export const requireStaff: RequestHandler[] = [requireAuth, requirePasswordChanged, requireRole('staff')];
export const requireStudent: RequestHandler[] = [requireAuth, requirePasswordChanged, requireRole('student')];
