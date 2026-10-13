export const PDF_MIME = 'application/pdf';
/** Kept so a DOCX can be named in tests and messages; it is refused since files became PDF only (UI-POLISH-SPEC D7). */
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_SANCTION = 5;

export type UploadErrorCode = 'unsupported_type' | 'empty' | 'too_large' | 'too_many_files' | 'content_mismatch';
export type UploadValidation = { ok: true; ext: 'pdf' } | { ok: false; code: UploadErrorCode };

export interface UploadCandidate {
  mimeType: string;
  bytes: Uint8Array;
  /** Files already attached to the sanction. */
  existingCount: number;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((value, index) => bytes[index] === value);
}

/**
 * Pure upload rules (SPEC 6.1, 4.3). Files are PDF only so every file can be previewed inside the app:
 * the MIME type must be PDF and the bytes must start with `%PDF`. Status checks belong to the services.
 */
export function validateUpload({ mimeType, bytes, existingCount }: UploadCandidate): UploadValidation {
  if (mimeType !== PDF_MIME) return { ok: false, code: 'unsupported_type' };
  if (bytes.length === 0) return { ok: false, code: 'empty' };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, code: 'too_large' };
  if (existingCount >= MAX_FILES_PER_SANCTION) return { ok: false, code: 'too_many_files' };
  if (!startsWith(bytes, PDF_MAGIC)) return { ok: false, code: 'content_mismatch' };
  return { ok: true, ext: 'pdf' };
}

/** The one message for a file that is not a PDF, whether by type or by content. */
export const notPdfMessage = (name: string): string => `${name} is not a PDF file.`;
