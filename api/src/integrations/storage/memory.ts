import { PRESIGN_TTL_SECONDS, type ObjectStorage } from './types.js';

export interface MemoryStorage extends ObjectStorage {
  readonly objects: Map<string, { body: Uint8Array; contentType: string }>;
}

/** In-memory fake for tests; never touches the network. */
export function createMemoryStorage(): MemoryStorage {
  const objects = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    objects,
    async put(key, body, contentType) {
      objects.set(key, { body, contentType });
    },
    async delete(key) {
      objects.delete(key);
    },
    async presignGet(key, expiresInSeconds = PRESIGN_TTL_SECONDS) {
      if (!objects.has(key)) throw new Error(`Object not found: ${key}`);
      return `memory://${key}?expires=${expiresInSeconds}`;
    },
  };
}
