import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '@/api/client';
import { PublicSplit } from '@/components/layout/PublicSplit';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { controlVariants } from '@/components/ui/FieldShell';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/context/AuthContext';
import { LOGIN_LOCK_SECONDS, LOGIN_MAX_ATTEMPTS, lockLabel, wrongCredentials } from '@/utils/account';
import { loginErrors, type LoginErrors } from '@/validators/account';
import { cn } from '@/utils/cn';

const FORGOT_TEXT = 'Visit the SDO in Room 204 for a temporary password.';

function FieldError({ id, children }: { id: string; children: string }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-strong">
      <Icon name="error" className="!text-[18px]" />
      {children}
    </p>
  );
}

/** Sign-in (deck W01 to W04, M01 to M04): per-field errors, a wrong-credentials banner, a 60-second pause after 5 failures. */
export default function Login() {
  const { state, signIn } = useAuth();
  const ids = useId();
  const emailId = `${ids}-email`;
  const passwordId = `${ids}-password`;
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [failures, setFailures] = useState(0);
  // Seconds of the pause left; null when sign-in is open.
  const [lockLeft, setLockLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  useEffect(() => {
    if (lockLeft === null) return;
    if (lockLeft <= 0) {
      setLockLeft(null);
      setFailures(0);
      setBanner(null);
      return;
    }
    const timer = setTimeout(() => setLockLeft((current) => (current === null ? null : current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [lockLeft]);

  if (state.status === 'authenticated') return <Navigate to="/" replace />;

  const locked = lockLeft !== null;

  function trackCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLock(event.getModifierState('CapsLock'));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (locked || busy) return;
    const found = loginErrors(email, password);
    setFieldErrors(found);
    if (found.email || found.password) {
      setBanner(null);
      (found.email ? emailRef : passwordRef).current?.focus();
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        const next = failures + 1;
        setFailures(next);
        if (next >= LOGIN_MAX_ATTEMPTS) setLockLeft(LOGIN_LOCK_SECONDS);
        else setBanner(wrongCredentials(next));
      } else {
        setBanner(caught instanceof ApiError ? caught.message : 'Something went wrong. Try again.');
      }
      setBusy(false);
    }
  }

  const iconClass = 'pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 !text-xl text-muted-2';

  return (
    <PublicSplit>
      <h1 className="text-[28px] leading-tight font-bold text-ink">Sign in</h1>
      <p className="mt-1.5 mb-6 text-sm text-pretty text-muted">Use your NU email and SDO Portal password.</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {locked ? (
          <Alert tone="warning" icon="lock_clock">
            Too many incorrect attempts. Sign-in is paused for a minute. {lockLabel(lockLeft)}.
          </Alert>
        ) : banner ? (
          <Alert tone="error">{banner}</Alert>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={emailId} className="text-[13px] font-semibold text-ink">
            NU email
          </label>
          <span className="relative block">
            <Icon name="mail" className={iconClass} />
            <input
              ref={emailRef}
              id={emailId}
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="e.g. jdelacruz@students.nu-fairview.edu.ph"
              value={email}
              aria-invalid={fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
              className={cn(controlVariants({ invalid: Boolean(fieldErrors.email), size: 'lg' }), 'pl-10')}
              onChange={(event) => {
                setEmail(event.target.value);
                setFieldErrors((current) => ({ ...current, email: undefined }));
                setBanner(null);
              }}
            />
          </span>
          {fieldErrors.email ? <FieldError id={`${emailId}-error`}>{fieldErrors.email}</FieldError> : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor={passwordId} className="text-[13px] font-semibold text-ink">
              Password
            </label>
            <button
              type="button"
              aria-expanded={showHelp}
              onClick={() => setShowHelp((value) => !value)}
              className="min-h-8 rounded-full px-1 text-[13px] font-semibold text-primary hover:underline focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:outline-none"
            >
              Forgot password?
            </button>
          </div>
          {showHelp ? <Alert tone="info">{FORGOT_TEXT}</Alert> : null}
          <span className="relative block">
            <Icon name="lock" className={iconClass} />
            <input
              ref={passwordRef}
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? `${passwordId}-error` : undefined}
              className={cn(controlVariants({ invalid: Boolean(fieldErrors.password), size: 'lg' }), 'pr-12 pl-10')}
              onKeyDown={trackCapsLock}
              onKeyUp={trackCapsLock}
              onBlur={() => setCapsLock(false)}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((current) => ({ ...current, password: undefined }));
                setBanner(null);
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute top-1/2 right-1 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-line-soft focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:outline-none"
            >
              <Icon name={showPassword ? 'visibility_off' : 'visibility'} className="!text-xl" />
            </button>
          </span>
          {fieldErrors.password ? <FieldError id={`${passwordId}-error`}>{fieldErrors.password}</FieldError> : null}
          {capsLock ? (
            <p role="status" className="flex items-center gap-1.5 text-[13px] font-semibold text-warn-ink">
              <Icon name="keyboard_capslock" className="!text-[18px]" />
              Caps Lock is on.
            </p>
          ) : null}
        </div>

        <Button type="submit" size="xl" fullWidth busy={busy} busyLabel="Signing in…" disabled={locked}>
          {locked ? lockLabel(lockLeft) : 'Sign in'}
        </Button>
      </form>
    </PublicSplit>
  );
}
