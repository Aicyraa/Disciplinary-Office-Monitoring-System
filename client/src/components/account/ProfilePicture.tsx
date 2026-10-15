import { useRef, useState, type ChangeEvent } from 'react';
import type { AuthUser } from '@shared/types';
import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { useToast } from '@/components/feedback';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/context/AuthContext';
import { AVATAR_ACCEPT, avatarFileError } from '@/validators/avatar';

/** Change or remove your own profile picture, inside "Account details" (SPEC 4.8). */
export function ProfilePicture({ user }: { user: AuthUser }) {
  const { setUser } = useAuth();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'save' | 'remove', send: () => Promise<{ user: AuthUser }>, done: string) {
    setBusy(kind);
    setError(null);
    try {
      const { user: next } = await send();
      setUser(next);
      toast.show(done, 'success');
    } catch (caught) {
      setError(toApiError(caught).message);
    } finally {
      setBusy(null);
    }
  }

  function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const problem = avatarFileError(file);
    if (problem) {
      setError(problem);
      return;
    }
    void run('save', () => authApi.setAvatar(file), 'Profile picture updated.');
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Avatar firstName={user.firstName} lastName={user.lastName} url={user.avatarUrl} className="size-16 bg-gold text-xl" />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" busy={busy === 'save'} disabled={busy !== null} onClick={() => input.current?.click()}>
            <Icon name="photo_camera" className="!text-lg" />
            {user.avatarUrl ? 'Change picture' : 'Add picture'}
          </Button>
          {user.avatarUrl ? (
            <Button
              variant="neutral"
              size="sm"
              busy={busy === 'remove'}
              disabled={busy !== null}
              onClick={() => void run('remove', () => authApi.removeAvatar(), 'Profile picture removed.')}
            >
              Remove
            </Button>
          ) : null}
        </div>
        <input ref={input} type="file" accept={AVATAR_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choose a profile picture" onChange={onPick} />
      </div>
      <p className="text-xs text-muted">JPG, PNG or WebP, up to 2 MB.</p>
      {error ? (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
          <Icon name="error" className="!text-lg" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
