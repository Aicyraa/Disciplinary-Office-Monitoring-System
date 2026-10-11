import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { buttonClass, Card, fieldClass, PageHeader } from '../components/ui';
import { api, ApiError } from '../lib/api';

interface Fields {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Same rules the API enforces (SPEC 4.8). The API stays the authority; this only saves a round trip. */
export function passwordRuleError(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Za-z]/.test(password)) return 'Include at least one letter.';
  if (!/\d/.test(password)) return 'Include at least one digit.';
  return null;
}

export default function ChangePassword() {
  const { state, setUser } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<Fields>();

  if (state.status !== 'authenticated') return <Navigate to="/login" replace />;
  const forced = state.user.mustChangePassword;

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      const { user } = await api.changePassword(currentPassword, newPassword);
      setUser(user);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
    }
  });

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <PageHeader
        title="Change your password"
        subtitle={forced ? 'You must set a new password before you can continue.' : undefined}
      />
      <Card>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-ink">
              {forced ? 'Temporary password' : 'Current password'}
            </label>
            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              className={fieldClass}
              {...register('currentPassword', { required: 'Enter your current password.' })}
            />
            {errors.currentPassword ? <p className="mt-1 text-sm text-danger">{errors.currentPassword.message}</p> : null}
          </div>
          <div>
            <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-ink">
              New password
            </label>
            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              className={fieldClass}
              {...register('newPassword', { validate: (value) => passwordRuleError(value) ?? true })}
            />
            {errors.newPassword ? <p className="mt-1 text-sm text-danger">{errors.newPassword.message}</p> : null}
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-ink">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              className={fieldClass}
              {...register('confirmPassword', {
                validate: (value) => value === getValues('newPassword') || 'The passwords do not match.',
              })}
            />
            {errors.confirmPassword ? <p className="mt-1 text-sm text-danger">{errors.confirmPassword.message}</p> : null}
          </div>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {formError}
            </p>
          ) : null}
          <button type="submit" disabled={isSubmitting} className={buttonClass}>
            {isSubmitting ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </Card>
    </div>
  );
}
