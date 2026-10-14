import type { RequestHandler } from 'express';
import type { Authenticator } from '../config/passport.js';
import type { AuthUser } from '@shared/types.js';
import { sendError, sendOk } from '../helpers/http.js';
import type { AuthService } from '../services/auth.service.js';
import { parseChangePasswordBody, parseStudentIdParam } from '../validators/auth.validators.js';

export interface AuthControllerDeps {
  service: AuthService;
  authenticator: Authenticator;
  /**
   * Called after staff reset a student's password (an `account` notification). It must not carry the temporary
   * password. A failure here is logged and never undoes or hides the reset.
   */
  onPasswordReset?: (studentId: string) => Promise<void>;
}

/** Sign-in, sign-out, password change and staff password reset (SPEC 4.8, FEATURE-RULES 3.1). */
export function createAuthController({ service, authenticator, onPasswordReset }: AuthControllerDeps) {
  const login: RequestHandler = (request, response, next) => {
    authenticator.authenticate('local', (error: unknown, user: AuthUser | false) => {
      if (error) return next(error);
      // One message for every failure (unknown email, wrong password, bad domain, inactive, malformed).
      if (!user) return sendError(response, 401, 'invalid_credentials', 'Invalid email or password.');
      // req.logIn regenerates the session id (no session fixation).
      request.logIn(user, (loginError) => {
        if (loginError) return next(loginError);
        sendOk(response, { user });
      });
    })(request, response, next);
  };

  const logout: RequestHandler = (request, response, next) => {
    request.logout((error) => {
      if (error) return next(error);
      request.session.destroy(() => {
        response.clearCookie('sdo.sid');
        sendOk(response, null);
      });
    });
  };

  const me: RequestHandler = (request, response) => {
    sendOk(response, { user: request.user });
  };

  const changePassword: RequestHandler = async (request, response, next) => {
    const input = parseChangePasswordBody(request.body);
    if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
    const user = request.user as AuthUser;
    const result = await service.changePassword(user.role, user.id, input.value.currentPassword, input.value.newPassword);
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
  };

  /** The temp password is returned once and never stored in clear text. */
  const resetStudentPassword: RequestHandler = async (request, response) => {
    const studentId = parseStudentIdParam(request.params.studentId);
    if (!studentId.ok) return sendError(response, 400, 'invalid_input', studentId.message);
    const result = await service.resetStudentPassword(studentId.value);
    if (!result.ok) return sendError(response, 404, 'student_not_found', 'No student has that ID.');
    try {
      await onPasswordReset?.(studentId.value);
    } catch (error) {
      // The password is already reset and the temp password must reach the staff member: never fail here.
      console.error('Could not record the password-reset notification', error);
    }
    response.set('Cache-Control', 'no-store');
    sendOk(response, { tempPassword: result.tempPassword });
  };

  return { login, logout, me, changePassword, resetStudentPassword };
}
