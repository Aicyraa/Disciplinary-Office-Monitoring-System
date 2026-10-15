import { useRef, useState, type ChangeEvent } from 'react';
import type { AuthUser } from '@shared/types';
import { authApi } from '@/api/auth';
import { toApiError } from '@/api/client';
import { useToast } from '@/components/feedback';
import { Avatar } from '@/components/ui/Avatar';
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
      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => input.current?.click()}
          aria-label={user.avatarUrl ? 'Change profile picture' : 'Add profile picture'}
          title={user.avatarUrl ? 'Change picture' : 'Add picture'}
          className="group relative size-20 shrink-0 cursor-pointer rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35 disabled:cursor-wait"
        >
          <Avatar firstName={user.firstName} lastName={user.lastName} url={user.avatarUrl} className="size-20 bg-gold text-2xl" />
          <span
            aria-hidden="true"
            className={`absolute inset-0 grid place-items-center rounded-full bg-ink/55 text-white transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${busy === 'save' ? 'opacity-100' : 'opacity-0'}`}
          >
            <Icon name={busy === 'save' ? 'progress_activity' : 'edit'} className={busy === 'save' ? 'animate-spin' : ''} />
          </span>
        </button>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <p className="text-xs text-muted">Click the picture to change it. JPG, PNG or WebP, up to 2 MB.</p>
          {user.avatarUrl ? (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void run('remove', () => authApi.removeAvatar(), 'Profile picture removed.')}
              className="text-xs font-semibold text-danger-strong underline disabled:opacity-50"
            >
              {busy === 'remove' ? 'Removing…' : 'Remove picture'}
            </button>
          ) : null}
        </div>
        <input ref={input} type="file" accept={AVATAR_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choose a profile picture" onChange={onPick} />
      </div>
      {error ? (
        <p role="alert" className="flex items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-[13px] text-danger-ink">
          <Icon name="error" className="!text-lg" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
