import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { PublicSplit } from '@/components/layout/PublicSplit';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/context/AuthContext';
import { loginProblem } from '@/utils/account';

const FORGOT_TEXT =
  'Visit the SDO office (Room 204) with your school ID. Staff will give you a one-time temporary password, and you’ll choose a new one when you sign in.';
const WRONG = 'That NU email and password don’t match. Check them and try again.';

/** Sign-in (deck W01 to W04, M01 to M04). */
export default function Login() {
  const { state, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  if (state.status === 'authenticated') return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = loginProblem(email, password);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      // A refused sign-in is always the same sentence; other failures keep the API's own message.
      setError(caught instanceof ApiError && caught.status === 401 ? WRONG : caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <PublicSplit>
      <h1 className="text-[26px] leading-tight font-bold text-ink">Student Discipline Office Portal</h1>
      <p className="mt-1.5 mb-5 text-[13px] text-muted">Sign in with your NU email and password.</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field
          label="NU email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="e.g. jdelacruz@students.nu-fairview.edu.ph"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
        />
        <div className="relative">
          <Field
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Password"
            className="pr-12"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute right-1 bottom-0.5 grid size-10 place-items-center rounded-full text-muted hover:bg-line-soft focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:outline-none"
          >
            <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="!text-xl" />
          </button>
        </div>
        <div className="-mt-1.5 flex justify-end">
          <button
            type="button"
            aria-expanded={showHelp}
            onClick={() => setShowHelp((value) => !value)}
            className="min-h-11 rounded-full px-1 text-[13px] font-semibold text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:outline-none"
          >
            Forgot password?
          </button>
        </div>
        {showHelp ? (
          <Alert tone="info" className="-mt-1.5">
            {FORGOT_TEXT}
          </Alert>
        ) : null}
        <Button type="submit" size="xl" busy={busy} busyLabel="Signing in…">
          Sign in
        </Button>
      </form>
    </PublicSplit>
  );
}
