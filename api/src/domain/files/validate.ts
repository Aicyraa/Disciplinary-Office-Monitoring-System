export const PDF_MIME = 'application/pdf';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_SANCTION = 5;

export type UploadErrorCode = 'unsupported_type' | 'empty' | 'too_large' | 'too_many_files' | 'content_mismatch';
export type UploadValidation = { ok: true; ext: 'pdf' | 'docx' } | { ok: false; code: UploadErrorCode };

export interface UploadCandidate {
  mimeType: string;
  bytes: Uint8Array;
  /** Files already attached to the sanction. */
  existingCount: number;
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP_MAGIC = [0x50, 0x4b]; // PK (DOCX is a ZIP container)

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  return magic.every((value, index) => bytes[index] === value);
}

/** Pure upload rules (SPEC 6.1, 4.3). Status checks belong to the sanction service. */
export function validateUpload({ mimeType, bytes, existingCount }: UploadCandidate): UploadValidation {
  let ext: 'pdf' | 'docx';
  let magic: number[];
  if (mimeType === PDF_MIME) {
    ext = 'pdf';
    magic = PDF_MAGIC;
  } else if (mimeType === DOCX_MIME) {
    ext = 'docx';
    magic = ZIP_MAGIC;
  } else {
    return { ok: false, code: 'unsupported_type' };
  }

  if (bytes.length === 0) return { ok: false, code: 'empty' };
  if (bytes.length > MAX_FILE_BYTES) return { ok: false, code: 'too_large' };
  if (existingCount >= MAX_FILES_PER_SANCTION) return { ok: false, code: 'too_many_files' };
  if (!startsWith(bytes, magic)) return { ok: false, code: 'content_mismatch' };

  return { ok: true, ext };
}
