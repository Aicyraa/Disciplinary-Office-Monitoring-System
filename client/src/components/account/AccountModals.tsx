import { useEffect, useId, useState, type FormEvent } from 'react';
import type { AuthUser, StudentProfileView } from '@shared/types';
import { api, toApiError } from '@/api/client';
import { Dialog } from '@/components/feedback/Dialog';
import { useToast } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/context/AuthContext';
import { accountRows } from '@/utils/account';
import { passwordChangeError, passwordRules } from '@/validators/account';
import { initials } from '@/utils/nav';

/** The live checklist under a new password (deck src 2058). */
export function PasswordRuleList({ password }: { password: string }) {
  return (
    <ul className="flex flex-col gap-1.5" aria-label="Password rules">
      {passwordRules(password).map((rule) => (
        <li key={rule.text} className={`flex items-center gap-2 text-[13px] ${rule.ok ? 'text-success' : 'text-muted'}`}>
          <Icon name={rule.ok ? 'check_circle' : 'radio_button_unchecked'} className="!text-lg" />
          {rule.text}
          <span className="sr-only">{rule.ok ? '(met)' : '(not met yet)'}</span>
        </li>
      ))}
    </ul>
  );
}

/** Account details (deck W83, src 2018): read-only; corrections go through the SDO. */
export function AccountDetailsModal({
  open,
  user,
  onClose,
  onChangePassword,
}: {
  open: boolean;
  user: AuthUser;
  onClose: () => void;
  onChangePassword: () => void;
}) {
  const titleId = useId();
  const [profile, setProfile] = useState<StudentProfileView | null>(null);

  useEffect(() => {
    if (!open || user.role !== 'student') return;
    let cancelled = false;
    api.myProfile().then(
      (data) => !cancelled && setProfile(data.profile),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [open, user.role]);

  return (
    <Dialog open={open} labelledBy={titleId} onClose={onClose}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full bg-gold font-bold text-ink">
          {initials(user.firstName, user.lastName)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-xl font-bold text-ink">
            {user.firstName} {user.lastName}
          </h2>
          <p className="text-[13px] text-muted">Account details</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full text-muted hover:bg-line-soft focus-visible:ring-[3px] focus-visible:ring-primary/30 focus-visible:outline-none"
        >
          <Icon name="close" />
        </button>
      </div>
      <dl className="flex flex-col rounded-[10px] border border-line-soft">
        {accountRows(user, profile).map(([label, value]) => (
          <div key={label} className="flex gap-3 border-b border-line-soft px-3 py-2.5 text-[13px] last:border-b-0">
            <dt className="w-[110px] shrink-0 text-muted">{label}</dt>
            <dd className="min-w-0 flex-1 font-semibold break-words text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted">To correct these details, contact the Student Discipline Office.</p>
      <Button variant="secondary" size="lg" onClick={onChangePassword}>
        Change password
      </Button>
    </Dialog>
  );
}

/** Change password (deck W84 / W85, src 2037): current, new and confirm, the live rules and one alert. */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const titleId = useId();
  const { setUser } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
    setBusy(false);
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = passwordChangeError({ current, next, confirm });
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    try {
      const { user } = await api.changePassword(current, next);
      setUser(user);
      toast.show('Password changed.', 'success');
      onClose();
    } catch (caught) {
      setError(toApiError(caught).message);
      setBusy(false);
    }
  }

  const clear = () => setError(null);

  return (
    <Dialog open={open} labelledBy={titleId} onClose={busy ? undefined : onClose} maxWidth="max-w-[420px]">
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        <h2 id={titleId} className="text-xl font-bold text-ink">
          Change password
        </h2>
        {error ? (
          <p role="alert" className="flex items-center gap-2.5 rounded-lg border border-danger-line bg-danger-soft px-3 py-2.5 text-[13px] text-danger-ink">
            <Icon name="error" className="!text-xl" />
            {error}
          </p>
        ) : null}
        <Field label="Current password" type="password" autoComplete="current-password" value={current} onChange={(e) => { setCurrent(e.target.value); clear(); }} />
        <Field label="New password" type="password" autoComplete="new-password" value={next} onChange={(e) => { setNext(e.target.value); clear(); }} />
        <Field label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => { setConfirm(e.target.value); clear(); }} />
        <PasswordRuleList password={next} />
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="neutral" size="lg" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="lg" busy={busy}>
            Change password
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
