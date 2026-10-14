import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, toApiError } from '@/api/client';
import { PasswordRuleList } from '@/components/account/AccountModals';
import { useToast } from '@/components/feedback';
import { PublicSplit } from '@/components/layout/PublicSplit';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { useAuth } from '@/context/AuthContext';
import { forcedPasswordError } from '@/validators/account';

/**
 * "Set a new password" after signing in with a temporary password (deck W05, W06). Only the new password and
 * its confirmation: the session already proved the temporary one (UI-POLISH-SPEC D1). An ordinary change is
 * the Change password dialog, so anyone else is sent there.
 */
export default function ChangePassword() {
  const { state, setUser, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (state.status === 'anonymous') return <Navigate to="/login" replace />;
  if (state.status !== 'authenticated') return null;
  if (!state.user.mustChangePassword) return <Navigate to="/account/password" replace />;
  const { user } = state;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = forcedPasswordError(next, confirm);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { user: updated } = await api.changePassword(null, next);
      setUser(updated);
      toast.show('Password set. Welcome back.', 'success');
      navigate('/', { replace: true });
    } catch (caught) {
      setError(toApiError(caught).message);
      setBusy(false);
    }
  }

  return (
    <PublicSplit>
      <h1 className="text-[26px] leading-tight font-bold text-ink">Set a new password</h1>
      <p className="mt-1.5 mb-5 text-[13px] text-pretty text-muted">
        Hi {user.firstName} {user.lastName}. You signed in with a temporary password from the SDO. Choose a new password to continue.
      </p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(event) => {
            setNext(event.target.value);
            setError(null);
          }}
        />
        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            setError(null);
          }}
        />
        <PasswordRuleList password={next} />
        <Button type="submit" size="xl" busy={busy}>
          Save and continue
        </Button>
        <Button variant="text" size="lg" onClick={() => void signOut().then(() => navigate('/login', { replace: true }))}>
          Back to sign in
        </Button>
      </form>
    </PublicSplit>
  );
}
