export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type AvatarExt = 'jpg' | 'png' | 'webp';
export type AvatarErrorCode = 'unsupported_type' | 'empty' | 'too_large' | 'content_mismatch';
export type AvatarValidation = { ok: true; ext: AvatarExt; mimeType: string } | { ok: false; code: AvatarErrorCode };

const TYPES: Record<string, AvatarExt> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]; // "WEBP", at bytes 8 to 11

const hasBytes = (bytes: Uint8Array, magic: number[], offset = 0): boolean =>
  magic.every((value, index) => bytes[offset + index] === value);

function matchesContent(ext: AvatarExt, bytes: Uint8Array): boolean {
  if (ext === 'jpg') return hasBytes(bytes, JPEG_MAGIC);
  if (ext === 'png') return hasBytes(bytes, PNG_MAGIC);
  return hasBytes(bytes, RIFF_MAGIC) && hasBytes(bytes, WEBP_MAGIC, 8);
}

/**
 * Pure profile-picture rules (SPEC 4.8): JPG, PNG or WebP, up to 2 MB, and the first bytes must match the
 * declared type, so a renamed document is refused. The file name is never trusted.
 */
export function validateAvatar({ mimeType, bytes }: { mimeType: string; bytes: Uint8Array }): AvatarValidation {
  const ext = TYPES[mimeType];
  if (!ext) return { ok: false, code: 'unsupported_type' };
  if (bytes.length === 0) return { ok: false, code: 'empty' };
  if (bytes.length > MAX_AVATAR_BYTES) return { ok: false, code: 'too_large' };
  if (!matchesContent(ext, bytes)) return { ok: false, code: 'content_mismatch' };
  return { ok: true, ext, mimeType };
}

/** One message per refusal, shown to the person as is. */
export const AVATAR_MESSAGES: Record<AvatarErrorCode, string> = {
  unsupported_type: 'Choose a JPG, PNG or WebP picture.',
  empty: 'That file is empty.',
  too_large: 'The picture is larger than 2 MB.',
  content_mismatch: 'That file is not a valid picture.',
};
