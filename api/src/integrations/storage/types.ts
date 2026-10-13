import { randomUUID } from 'node:crypto';

/** Presigned GET lifetime (SPEC 6.1 step 2). */
export const PRESIGN_TTL_SECONDS = 60;

export interface ObjectStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  /** Idempotent: deleting a missing key is not an error. */
  delete(key: string): Promise<void>;
  presignGet(key: string, expiresInSeconds?: number): Promise<string>;
}

export type FileExt = 'pdf' | 'docx';

export function proofKey(caseSanctionId: number, ext: FileExt, uuid: () => string = randomUUID): string {
  return `proof/${caseSanctionId}/${uuid()}.${ext}`;
}

export function templateKey(sanctionId: number, ext: FileExt, uuid: () => string = randomUUID): string {
  return `templates/${sanctionId}/${uuid()}.${ext}`;
}
