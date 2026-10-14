import { STUDENT_ID_PATTERN } from '../domain/auth/policy.js';
import { invalid, valid, type Validated } from '../helpers/validation.js';

/** A body field that is a string, or null (JSON can carry numbers, objects, arrays). */
export const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/**
 * currentPassword may be left out only right after a temporary-password sign-in (D1); the service decides
 * whether it was needed.
 */
export function parseChangePasswordBody(
  body: unknown,
): Validated<{ currentPassword: string | null; newPassword: string }> {
  const source = (body ?? {}) as Record<string, unknown>;
  const newPassword = asString(source.newPassword);
  if (newPassword === null) return invalid('currentPassword and newPassword are required.');
  return valid({ currentPassword: asString(source.currentPassword) || null, newPassword });
}

export function parseStudentIdParam(value: unknown): Validated<string> {
  const studentId = String(value);
  if (!STUDENT_ID_PATTERN.test(studentId)) return invalid('Student ID must look like 2025-1234567.');
  return valid(studentId);
}
