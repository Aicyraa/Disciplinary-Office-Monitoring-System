import type { AccountRole, AuthUser } from '@shared/types.js';
import { AVATAR_MESSAGES, validateAvatar, type AvatarErrorCode } from '../domain/avatar/validate.js';
import { avatarKey, type ObjectStorage } from '../integrations/storage/types.js';
import type { AccountRepo } from '../repositories/auth/repo.js';

export type AvatarResult = { ok: true; user: AuthUser } | { ok: false; code: AvatarErrorCode | 'not_found'; message: string };

export interface AvatarService {
  /** Replaces the account's own picture. The old object is deleted only after the new one is saved. */
  set(role: AccountRole, id: string, file: { mimeType: string; bytes: Uint8Array }): Promise<AvatarResult>;
  /** Clears the picture. Removing a picture that is not set is fine. */
  remove(role: AccountRole, id: string): Promise<AvatarResult>;
}

export interface AvatarServiceOptions {
  repo: AccountRepo;
  storage: ObjectStorage;
  /** The refreshed signed-in user (with a new picture link), as the auth service builds it. */
  loadUser: (role: AccountRole, id: string) => Promise<AuthUser | null>;
  uuid?: () => string;
}

/** Profile pictures (SPEC 4.8, 6.1). Only ever the caller's own account: the id comes from the session. */
export function createAvatarService({ repo, storage, loadUser, uuid }: AvatarServiceOptions): AvatarService {
  const notFound: AvatarResult = { ok: false, code: 'not_found', message: 'Account not found.' };

  // A leftover object costs a little space and nothing else, so a failed delete never fails the request.
  const dropQuietly = async (key: string | null | undefined) => {
    if (!key) return;
    try {
      await storage.delete(key);
    } catch (error) {
      console.error('Could not delete a profile picture object', error);
    }
  };

  return {
    async set(role, id, file) {
      const account = await repo.findById(role, id);
      if (!account || !account.isActive) return notFound;
      const checked = validateAvatar(file);
      if (!checked.ok) return { ok: false, code: checked.code, message: AVATAR_MESSAGES[checked.code] };

      const key = avatarKey(role, id, checked.ext, uuid);
      await storage.put(key, file.bytes, checked.mimeType);
      let saved = false;
      try {
        saved = await repo.updateAvatarKey(role, id, key);
      } catch (error) {
        await dropQuietly(key);
        throw error;
      }
      if (!saved) {
        await dropQuietly(key);
        return notFound;
      }
      await dropQuietly(account.avatarKey);
      const user = await loadUser(role, id);
      return user ? { ok: true, user } : notFound;
    },

    async remove(role, id) {
      const account = await repo.findById(role, id);
      if (!account || !account.isActive) return notFound;
      if (account.avatarKey) {
        await repo.updateAvatarKey(role, id, null);
        await dropQuietly(account.avatarKey);
      }
      const user = await loadUser(role, id);
      return user ? { ok: true, user } : notFound;
    },
  };
}
