import { describe, expect, test } from 'vitest';
import { DOCX_MIME, MAX_FILE_BYTES, MAX_FILES_PER_SANCTION, PDF_MIME, validateUpload } from '../../../src/domain/files/validate.js';

const pdfBytes = new TextEncoder().encode('%PDF-1.7 fake');
const docxBytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00]);

describe('validateUpload (PDF only, UI-POLISH-SPEC D7)', () => {
  test('accepts a PDF and returns the pdf extension', () => {
    expect(validateUpload({ mimeType: PDF_MIME, bytes: pdfBytes, existingCount: 4 })).toEqual({ ok: true, ext: 'pdf' });
  });

  test('refuses a DOCX: files are PDF only so every file can be previewed in the app', () => {
    expect(validateUpload({ mimeType: DOCX_MIME, bytes: docxBytes, existingCount: 0 })).toEqual({ ok: false, code: 'unsupported_type' });
  });

  test('rejects any other mime type', () => {
    expect(validateUpload({ mimeType: 'image/png', bytes: pdfBytes, existingCount: 0 })).toEqual({ ok: false, code: 'unsupported_type' });
  });

  test('rejects a PDF mime whose bytes are not %PDF (renamed file)', () => {
    expect(validateUpload({ mimeType: PDF_MIME, bytes: docxBytes, existingCount: 0 })).toEqual({ ok: false, code: 'content_mismatch' });
  });

  test('rejects an empty file', () => {
    expect(validateUpload({ mimeType: PDF_MIME, bytes: new Uint8Array(), existingCount: 0 })).toEqual({ ok: false, code: 'empty' });
  });

  test('accepts exactly 10 MB and rejects one byte more', () => {
    const atLimit = new Uint8Array(MAX_FILE_BYTES);
    atLimit.set(pdfBytes);
    expect(validateUpload({ mimeType: PDF_MIME, bytes: atLimit, existingCount: 0 }).ok).toBe(true);
    const over = new Uint8Array(MAX_FILE_BYTES + 1);
    over.set(pdfBytes);
    expect(validateUpload({ mimeType: PDF_MIME, bytes: over, existingCount: 0 })).toEqual({ ok: false, code: 'too_large' });
  });

  test('rejects a sixth file', () => {
    expect(
      validateUpload({ mimeType: PDF_MIME, bytes: pdfBytes, existingCount: MAX_FILES_PER_SANCTION }),
    ).toEqual({ ok: false, code: 'too_many_files' });
  });
});
