import { validateUpload, type UploadErrorCode } from '../domain/files/validate.js';
import { PRESIGN_TTL_SECONDS, templateKey, type ObjectStorage } from '../integrations/storage/types.js';
import type { TemplateStore } from '../types/templates.types.js';

export type TemplateFailureCode = UploadErrorCode | 'not_found' | 'invalid_input';

export interface TemplateFailure {
  ok: false;
  code: TemplateFailureCode;
  message: string;
}

export type TemplateResult<T> = ({ ok: true } & T) | TemplateFailure;

export interface TemplateUpload {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

/** A template holds one file; uploading again replaces it (UI-POLISH-SPEC decision 7). */
export const FILES_PER_TEMPLATE = 1;
export const MAX_TITLE_LENGTH = 200;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_REQUIREMENTS_LENGTH = 4000;

const fail = (code: TemplateFailureCode, message: string): TemplateFailure => ({ ok: false, code, message });

/** Trimmed text; `null` when empty or absent; `undefined` when it is not text or too long. */
function text(value: unknown, max: number): string | null | undefined {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  return trimmed.length <= max ? trimmed : undefined;
}

function uploadMessage(code: UploadErrorCode, name: string): string {
  switch (code) {
    case 'unsupported_type':
      return `${name}: only PDF or DOCX files are accepted.`;
    case 'empty':
      return `${name} is empty.`;
    case 'too_large':
      return `${name} is larger than 10 MB.`;
    case 'too_many_files':
      return 'A template holds one file. Upload a single file; it replaces the current one.';
    case 'content_mismatch':
      return `${name} does not look like a real PDF or DOCX file.`;
  }
}

export interface TemplateService {
  /** Sets the template's title, description and written requirements (staff). */
  saveText(input: {
    employeeId: string;
    sanctionId: number;
    title: unknown;
    description: unknown;
    requirements: unknown;
  }): Promise<TemplateResult<unknown>>;
  uploadFiles(input: { employeeId: string; sanctionId: number; files: TemplateUpload[] }): Promise<TemplateResult<{ fileIds: number[] }>>;
  removeFile(input: { employeeId: string; fileId: number }): Promise<TemplateResult<unknown>>;
  /** Any signed-in user may download a template file (SPEC 6.1). */
  downloadUrl(input: { fileId: number }): Promise<TemplateResult<{ url: string; expiresInSeconds: number }>>;
}

export function createTemplateService({
  store,
  storage,
  now = () => new Date(),
}: {
  store: TemplateStore;
  storage: ObjectStorage;
  now?: () => Date;
}): TemplateService {
  /** Deleting objects logs (never throws): an orphan object is harmless, a failed request is not. */
  async function discardObjects(keys: string[]): Promise<void> {
    const results = await Promise.allSettled(keys.map((key) => storage.delete(key)));
    for (const [index, result] of results.entries()) {
      if (result.status === 'rejected') console.error(`Could not delete object ${keys[index]}`, result.reason);
    }
  }

  return {
    async saveText({ employeeId, sanctionId, title, description, requirements }) {
      const titleText = text(title, MAX_TITLE_LENGTH);
      if (titleText === undefined) return fail('invalid_input', `The title must be text up to ${MAX_TITLE_LENGTH} characters.`);
      const descriptionText = text(description, MAX_DESCRIPTION_LENGTH);
      if (descriptionText === undefined) {
        return fail('invalid_input', `The description must be text up to ${MAX_DESCRIPTION_LENGTH} characters.`);
      }
      const requirementsText = text(requirements, MAX_REQUIREMENTS_LENGTH);
      if (requirementsText === undefined) {
        return fail('invalid_input', `The requirements must be text up to ${MAX_REQUIREMENTS_LENGTH} characters.`);
      }
      return store.transaction(async (tx) => {
        if (!(await tx.getSanction(sanctionId))) return fail('not_found', 'Sanction not found.');
        await tx.saveText({
          sanctionId,
          title: titleText,
          description: descriptionText,
          requirements: requirementsText,
          employeeId,
          date: now(),
        });
        return { ok: true as const };
      });
    },

    async uploadFiles({ employeeId, sanctionId, files }) {
      if (files.length === 0) return fail('invalid_input', 'Choose a file.');
      if (files.length > FILES_PER_TEMPLATE) return fail('too_many_files', uploadMessage('too_many_files', ''));

      // Phase 1 (short read): refuse early, before any bytes go to the bucket.
      const existing = await store.transaction(async (tx) => {
        return (await tx.getSanction(sanctionId)) !== null;
      });
      if (!existing) return fail('not_found', 'Sanction not found.');
      const extensions: Array<'pdf' | 'docx'> = [];
      for (const file of files) {
        const result = validateUpload({ mimeType: file.mimeType, bytes: file.bytes, existingCount: 0 });
        if (!result.ok) return fail(result.code, uploadMessage(result.code, file.name));
        extensions.push(result.ext);
      }

      // Phase 2 (no transaction open): the slow part.
      const stored: string[] = [];
      try {
        for (const [index, file] of files.entries()) {
          const key = templateKey(sanctionId, extensions[index]);
          await storage.put(key, file.bytes, file.mimeType);
          stored.push(key);
        }
      } catch (error) {
        await discardObjects(stored);
        throw error;
      }

      // Phase 3 (short write): replace whatever file is there, in one transaction.
      let outcome: TemplateResult<{ fileIds: number[] }>;
      const replaced: string[] = [];
      try {
        outcome = await store.transaction(async (tx) => {
          const template = await tx.getTemplate(sanctionId);
          if (!template) return fail('not_found', 'Sanction not found.');
          const at = now();
          const templateId = await tx.ensureTemplate(sanctionId, employeeId, at);
          for (const old of template.files) {
            await tx.deleteFile(old.fileId);
            replaced.push(old.storageKey);
          }
          const ids: number[] = [];
          for (const [index, file] of files.entries()) {
            ids.push(
              await tx.insertFile({
                templateId,
                storageKey: stored[index],
                originalName: file.name,
                mimeType: file.mimeType,
                sizeBytes: file.bytes.length,
                employeeId,
                date: at,
              }),
            );
          }
          await tx.touch(templateId, employeeId, at);
          return { ok: true as const, fileIds: ids };
        });
      } catch (error) {
        await discardObjects(stored);
        throw error;
      }
      if (!outcome.ok) await discardObjects(stored);
      // Committed: the replaced objects are removed best effort (a failure leaves an orphan, not an error).
      else await discardObjects(replaced);
      return outcome;
    },

    async removeFile({ employeeId, fileId }) {
      let key: string | null = null;
      const outcome = await store.transaction(async (tx): Promise<TemplateResult<unknown>> => {
        const file = await tx.getFile(fileId);
        if (!file) return fail('not_found', 'File not found.');
        await tx.deleteFile(fileId);
        await tx.touch(file.templateId, employeeId, now());
        key = file.storageKey;
        return { ok: true as const };
      });
      // Committed: removing the object is best effort and must not turn a success into an error.
      if (outcome.ok && key) await discardObjects([key]);
      return outcome;
    },

    async downloadUrl({ fileId }) {
      const key = await store.transaction(async (tx) => (await tx.getFile(fileId))?.storageKey ?? null);
      if (key === null) return fail('not_found', 'File not found.');
      const url = await storage.presignGet(key, PRESIGN_TTL_SECONDS);
      return { ok: true as const, url, expiresInSeconds: PRESIGN_TTL_SECONDS };
    },
  };
}
