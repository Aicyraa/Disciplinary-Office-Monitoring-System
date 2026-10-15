import { describe, expect, test } from 'vitest';
import { MAX_AVATAR_BYTES, validateAvatar } from '../../../src/domain/avatar/validate.js';
import { avatarKey } from '../../../src/integrations/storage/types.js';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

describe('validateAvatar', () => {
  test.each([
    ['image/jpeg', jpeg, 'jpg'],
    ['image/png', png, 'png'],
    ['image/webp', webp, 'webp'],
  ])('%s with matching bytes is accepted', (mimeType, bytes, ext) => {
    expect(validateAvatar({ mimeType, bytes })).toEqual({ ok: true, ext, mimeType });
  });

  test('other types are refused, even with image-looking bytes', () => {
    expect(validateAvatar({ mimeType: 'image/gif', bytes: png })).toEqual({ ok: false, code: 'unsupported_type' });
    expect(validateAvatar({ mimeType: 'application/pdf', bytes: new Uint8Array([0x25, 0x50]) })).toEqual({
      ok: false,
      code: 'unsupported_type',
    });
  });

  test('a renamed file is refused by its first bytes', () => {
    expect(validateAvatar({ mimeType: 'image/png', bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]) })).toEqual({
      ok: false,
      code: 'content_mismatch',
    });
    // RIFF but not WEBP (a WAV file).
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(validateAvatar({ mimeType: 'image/webp', bytes: wav })).toEqual({ ok: false, code: 'content_mismatch' });
  });

  test('empty and oversize files are refused; exactly 2 MB is fine', () => {
    expect(validateAvatar({ mimeType: 'image/png', bytes: new Uint8Array() })).toEqual({ ok: false, code: 'empty' });
    const atLimit = new Uint8Array(MAX_AVATAR_BYTES);
    atLimit.set(png);
    expect(validateAvatar({ mimeType: 'image/png', bytes: atLimit }).ok).toBe(true);
    const over = new Uint8Array(MAX_AVATAR_BYTES + 1);
    over.set(png);
    expect(validateAvatar({ mimeType: 'image/png', bytes: over })).toEqual({ ok: false, code: 'too_large' });
  });
});

describe('avatarKey', () => {
  test('one folder per account, split by audience, new name every time', () => {
    expect(avatarKey('student', '2025-0000001', 'png', () => 'u1')).toBe('avatars/student/2025-0000001/u1.png');
    expect(avatarKey('staff', 'E001', 'jpg', () => 'u2')).toBe('avatars/employee/E001/u2.jpg');
  });
});
