import { describe, expect, test } from 'vitest';
import { AVATAR_MAX_BYTES, avatarFileError } from '@/validators/avatar';

describe('avatarFileError', () => {
  test('JPG, PNG and WebP up to 2 MB pass', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(avatarFileError({ type, size: AVATAR_MAX_BYTES })).toBeNull();
    }
  });

  test('other types name the allowed ones', () => {
    expect(avatarFileError({ type: 'image/gif', size: 100 })).toBe('Choose a JPG, PNG or WebP picture.');
    expect(avatarFileError({ type: 'application/pdf', size: 100 })).toBe('Choose a JPG, PNG or WebP picture.');
  });

  test('empty and oversize files are refused', () => {
    expect(avatarFileError({ type: 'image/png', size: 0 })).toBe('That file is empty.');
    expect(avatarFileError({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toBe('The picture is larger than 2 MB.');
  });
});
