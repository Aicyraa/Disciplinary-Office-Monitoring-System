import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Card, PageHeader, Resource, buttonClass, fieldClass } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';

interface Fields {
  studentId: string;
  handbookEntryId: string;
}

export function RecordViolationPage() {
  const handbook = useApi(() => api.handbook(), []);
  const [outcome, setOutcome] = useState<{ caseId: number; converted: boolean } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ defaultValues: { studentId: '', handbookEntryId: '' } });

  const onSubmit = handleSubmit(async ({ studentId, handbookEntryId }) => {
    setFormError(null);
    setOutcome(null);
    try {
      const result = await api.recordViolation(studentId.trim(), Number(handbookEntryId));
      setOutcome({ caseId: result.caseId, converted: result.conversions.length > 0 });
      reset({ studentId: '', handbookEntryId: '' });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
    }
  });

  return (
    <>
      <PageHeader title="Record violation" subtitle="Record a violation you witnessed. It starts as validated." />
      <Card>
        <Resource resource={handbook} onRetry={handbook.reload}>
          {({ entries }) => (
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="studentId" className="mb-1 block text-sm font-medium text-ink">
                  Student ID
                </label>
                <input
                  id="studentId"
                  className={`${fieldClass} max-w-xs`}
                  placeholder="2025-1234567"
                  {...register('studentId', {
                    required: 'Enter the student ID.',
                    pattern: { value: /^\d{4}-\d{7}$/, message: 'Use the format 2025-1234567.' },
                  })}
                />
                {errors.studentId ? <p className="mt-1 text-sm text-danger">{errors.studentId.message}</p> : null}
              </div>
              <div>
                <label htmlFor="handbookEntryId" className="mb-1 block text-sm font-medium text-ink">
                  Violation
                </label>
                <select
                  id="handbookEntryId"
                  className={fieldClass}
                  {...register('handbookEntryId', { required: 'Choose a violation.' })}
                >
                  <option value="">Choose a violation…</option>
                  {entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.section} · {entry.violation} ({entry.severity})
                    </option>
                  ))}
                </select>
                {errors.handbookEntryId ? (
                  <p className="mt-1 text-sm text-danger">{errors.handbookEntryId.message}</p>
                ) : null}
              </div>
              {formError ? (
                <p role="alert" className="text-sm font-medium text-danger">
                  {formError}
                </p>
              ) : null}
              <button type="submit" disabled={isSubmitting} className={buttonClass}>
                {isSubmitting ? 'Recording…' : 'Record violation'}
              </button>
            </form>
          )}
        </Resource>
      </Card>
      {outcome ? (
        <p role="status" className="mt-4 text-sm font-medium text-success">
          Recorded as{' '}
          <Link to={`/cases/${outcome.caseId}`} className="underline">
            case C{String(outcome.caseId).padStart(3, '0')}
          </Link>
          .{outcome.converted ? ' This was the student’s third minor, so it was converted into a Major.' : ''}
        </p>
      ) : null}
    </>
  );
}
