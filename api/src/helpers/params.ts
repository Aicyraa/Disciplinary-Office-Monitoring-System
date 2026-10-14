import type { Request } from 'express';
import type { AuthUser } from '@shared/types.js';

/** A positive whole number from a path parameter (at most 9 digits), or null. Shared by every router. */
export function parseId(value: unknown): number | null {
  return typeof value === 'string' && /^\d{1,9}$/.test(value) ? Number(value) : null;
}

/** The signed-in account's id. Only call behind a guard from `middlewares/auth.ts`. */
export const sessionUserId = (request: Request): string => (request.user as AuthUser).id;
