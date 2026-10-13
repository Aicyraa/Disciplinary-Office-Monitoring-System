import { HttpError } from '../../lib/http.js';
import type { ObjectStorage } from './types.js';

/** What the person sees when the bucket cannot be reached; the real reason is only in the server log. */
export const STORAGE_UNAVAILABLE_MESSAGE =
  'File storage is not available right now. Please try again later, or tell the SDO office.';

export const storageUnavailable = (): HttpError => new HttpError(503, 'storage_unavailable', STORAGE_UNAVAILABLE_MESSAGE);

/**
 * Stand-in used in development when the bucket variables are not set: everything except file operations keeps
 * working, and a file operation fails with a clear message instead of a crash at startup.
 */
export function createUnavailableStorage(reason: string): ObjectStorage {
  const unavailable = async (): Promise<never> => {
    console.error(`Object storage is not configured: ${reason}`);
    throw storageUnavailable();
  };
  return { put: unavailable, delete: unavailable, presignGet: unavailable };
}
