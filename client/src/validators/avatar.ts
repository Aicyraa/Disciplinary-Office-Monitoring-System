/** Profile picture limits (SPEC 4.8). The API checks again; this only saves a round trip. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** For the file input's `accept`. */
export const AVATAR_ACCEPT = AVATAR_TYPES.join(',');

/** A message for the first problem with a chosen picture, or null when it can be sent. */
export function avatarFileError(file: { type: string; size: number }): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return 'Choose a JPG, PNG or WebP picture.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > AVATAR_MAX_BYTES) return 'The picture is larger than 2 MB.';
  return null;
}
