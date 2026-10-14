import { parseId } from '../helpers/params.js';
import { invalid, valid, type Validated } from '../helpers/validation.js';

export function parseSanctionId(body: unknown): Validated<number> {
  const sanctionId = ((body ?? {}) as Record<string, unknown>).sanctionId;
  if (!Number.isInteger(sanctionId) || (sanctionId as number) < 1) return invalid('sanctionId is required.');
  return valid(sanctionId as number);
}

/** The multipart text fields of a proof upload: which sanction, and optionally which file it replaces. */
export function parseProofUploadFields(
  body: unknown,
): Validated<{ caseSanctionId: number; replaceFileId: number | undefined }> {
  const source = (body ?? {}) as Record<string, unknown>;
  const caseSanctionId = parseId(source.caseSanctionId);
  const replaceRaw = source.replaceFileId;
  const replaceId = replaceRaw === undefined || replaceRaw === '' ? undefined : parseId(replaceRaw);
  if (caseSanctionId === null || replaceId === null) return invalid('caseSanctionId is required.');
  return valid({ caseSanctionId, replaceFileId: replaceId });
}
