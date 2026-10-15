import { STUDENT_ID_PATTERN } from '../domain/auth/policy.js';
import { invalid, valid, type Validated } from '../helpers/validation.js';

const PAGE = /^[1-9]\d{0,5}$/;
const FOCUS = /^[1-9]\d{0,9}$/;

/** `?page=`: absent means 1. */
export function parsePage(raw: unknown, message = 'page must be a positive whole number.'): Validated<number> {
  if (raw === undefined) return valid(1);
  if (typeof raw !== 'string' || !PAGE.test(raw)) return invalid(message);
  return valid(Number(raw));
}

/** `?q=`: text up to 100 characters, or absent. */
export function parseSearchText(raw: unknown): Validated<string | undefined> {
  if (raw === undefined) return valid(undefined);
  if (typeof raw !== 'string' || raw.length > 100) return invalid('q must be text up to 100 characters.');
  return valid(raw);
}

/** `?focus=`: a row id to land on, or absent. */
export function parseFocus(raw: unknown, message: string): Validated<number | undefined> {
  if (raw === undefined) return valid(undefined);
  if (typeof raw !== 'string' || !FOCUS.test(raw)) return invalid(message);
  return valid(Number(raw));
}

/** A student id from a body field, trimmed; invalid unless it matches YYYY-NNNNNNN (SPEC 3). */
export function parseStudentId(raw: unknown, message = 'Student ID must look like 2025-1234567.'): Validated<string> {
  if (typeof raw !== 'string' || !STUDENT_ID_PATTERN.test(raw.trim())) return invalid(message);
  return valid(raw.trim());
}
