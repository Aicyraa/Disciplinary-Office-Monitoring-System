import { invalid, valid, type Validated } from '../helpers/validation.js';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 100;

/** `?limit=1..100&unread=true|false` (SPEC 7). */
export function parseInboxQuery(query: Record<string, unknown>): Validated<{ limit: number; unreadOnly: boolean }> {
  const { limit, unread } = query;
  if (limit !== undefined && !(typeof limit === 'string' && /^[1-9]\d{0,2}$/.test(limit))) {
    return invalid(`limit must be a whole number from 1 to ${MAX_LIMIT}.`);
  }
  if (unread !== undefined && unread !== 'true' && unread !== 'false') return invalid('unread must be true or false.');
  return valid({
    limit: Math.min(limit === undefined ? DEFAULT_LIMIT : Number(limit), MAX_LIMIT),
    unreadOnly: unread === 'true',
  });
}
