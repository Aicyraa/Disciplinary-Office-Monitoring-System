import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { buttonClass, fieldClass } from '../components/ui';
import { ApiError } from '../lib/api';

interface LoginFields {
  email: string;
  password: string;
}

export default function Login() {
  const { state, signIn } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
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
    <div className="flex min-h-screen items-center justify-center bg-page px-4 py-10">
      <div className="w-full max-w-sm rounded-lg border border-line bg-white p-6">
        <h1 className="text-xl font-bold text-ink">Disciplinary Office Monitoring System</h1>
        <p className="mt-1 text-sm text-muted">NU Fairview Student Discipline Office. Sign in with your NU email.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-ink">
              NU email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              className={fieldClass}
              {...register('email', { required: true })}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={fieldClass}
              {...register('password', { required: true })}
            />
          </div>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {formError}
            </p>
          ) : null}
          <button type="submit" disabled={isSubmitting} className={`${buttonClass} w-full`}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-xs text-muted">
          Forgot your password? Visit the SDO office (Room 204) to get a temporary one.
        </p>
      </div>
    </div>
  );
}
