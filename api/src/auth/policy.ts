import { randomInt } from 'node:crypto';
import type { AccountRole } from '../../../shared/types.js';

export const STUDENT_EMAIL_DOMAIN = '@students.nu-fairview.edu.ph';
export const STAFF_EMAIL_DOMAIN = '@nu-fairview.edu.ph';
export const STUDENT_ID_PATTERN = /^\d{4}-\d{7}$/;
export const MIN_PASSWORD_LENGTH = 8;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** SPEC 4.8: only the two NU domains may sign in; anything else has no role. */
export function roleForEmail(email: string): AccountRole | null {
  const normalized = normalizeEmail(email);
  if (normalized.endsWith(STUDENT_EMAIL_DOMAIN)) return 'student';
  if (normalized.endsWith(STAFF_EMAIL_DOMAIN)) return 'staff';
  return null;
}

/** Returns an error message, or null when the password meets the rules (>= 8 chars, a letter and a digit). */
export function checkPasswordRules(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter.';
  if (!/\d/.test(password)) return 'Password must contain at least one digit.';
  return null;
}

/** One-time `Temp-####` password (SPEC 4.8). The caller hashes it and shows it to staff once. */
export function generateTempPassword(random: (maxExclusive: number) => number = randomInt): string {
  return `Temp-${String(random(10000)).padStart(4, '0')}`;
}
