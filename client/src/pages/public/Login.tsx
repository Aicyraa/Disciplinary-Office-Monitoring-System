import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import hero from '@/assets/hero.png';
import seal from '@/assets/seal.png';
import { Icon, buttonClass, fieldClass } from '@/components/ui';
import { ApiError } from '@/api/client';

interface LoginFields {
  email: string;
  password: string;
}

export default function Login() {
  const { state, signIn } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFields>({ defaultValues: { email: '', password: '' } });

  if (state.status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await signIn(email.trim(), password);
    } catch (error) {
      // The API answers every failure with one generic message; show it as given.
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
    }
  });

  return (
    <div className="grid min-h-screen bg-page rail:grid-cols-2">
      <aside
        aria-hidden="true"
        className="relative hidden items-center justify-center overflow-hidden bg-primary rail:flex"
        style={{ backgroundImage: `linear-gradient(rgba(38,47,115,0.82), rgba(38,47,115,0.9)), url(${hero})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="px-8 text-center text-white">
          <img src={seal} alt="" className="mx-auto size-24 rounded-full bg-white p-1" />
          <p className="mt-4 text-3xl font-extrabold tracking-wide">NU FAIRVIEW</p>
          <p className="mt-1 text-sm font-semibold text-gold">Student Discipline Office</p>
          <p className="mt-2 text-xs text-white/85">Violations · Sanctions · Clearance</p>
        </div>
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10">
        <div className="mb-6 flex items-center gap-3 rail:hidden">
          <img src={seal} alt="" className="size-10 rounded-full" />
          <p className="text-sm leading-tight font-bold text-ink">
            NU FAIRVIEW
            <span className="block text-xs font-normal text-muted">Student Discipline Office</span>
          </p>
        </div>

        <div className="w-full max-w-sm rounded-xl border border-line bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-ink">Student Discipline Office Portal</h1>
          <p className="mt-1 text-sm text-muted">Sign in with your NU email and password.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
                NU email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="e.g. jdelacruz@students.nu-fairview.edu.ph"
                className={`${fieldClass} min-h-11`}
                {...register('email', { required: true })}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Password"
                  className={`${fieldClass} min-h-11 pr-12`}
                  {...register('password', { required: true })}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute top-0 right-0 inline-flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-ink"
                >
                  <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                </button>
              </div>
              <div className="mt-1 text-right">
                <button
                  type="button"
                  aria-expanded={showHelp}
                  onClick={() => setShowHelp((value) => !value)}
                  className="min-h-11 text-xs font-medium text-primary underline"
                >
                  Forgot password?
                </button>
              </div>
              {showHelp ? (
                <p role="note" className="rounded-md bg-page px-3 py-2 text-xs text-body">
                  Forgot your password? Visit the SDO office (Room 204) to get a temporary one.
                </p>
              ) : null}
            </div>
            {formError ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {formError}
              </p>
            ) : null}
            <button type="submit" disabled={isSubmitting} className={`${buttonClass} min-h-11 w-full rounded-full`}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <Link to="/report" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline">
          <Icon name="qr_code_scanner" className="text-base" />
          Open the violation form
        </Link>
        <p className="mt-2 max-w-xs text-center text-xs text-muted">
          Room 204 is open Mon to Sat, 7:00 AM to 5:00 PM.
        </p>
      </main>
    </div>
  );
}
