import type { ObjectStorage } from './types.js';

/**
 * Stand-in used in development when the bucket variables are not set: everything except file operations keeps
 * working, and a file operation fails with a clear message instead of a crash at startup.
 */
export function createUnavailableStorage(reason: string): ObjectStorage {
  const unavailable = async (): Promise<never> => {
    throw new Error(`Object storage is not configured: ${reason}`);
  };
  return { put: unavailable, delete: unavailable, presignGet: unavailable };
}
