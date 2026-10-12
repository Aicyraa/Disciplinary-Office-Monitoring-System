import { useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import type { StaffAppointmentView } from '@shared/types';
import { ReasonForm } from '../components/ReasonForm';
import { Card, EmptyState, PageHeader, Resource, StatusPill, buttonClass, fieldClass } from '../components/ui';
import { api, ApiError, toApiError } from '../lib/api';
import { manilaToday } from '../lib/files';
import { formatDate, formatDateTime } from '../lib/format';
import { useApi } from '../lib/useApi';
import { appointmentEndDate, startDateProblem } from '../lib/workingDays';

const HOURS_NOTE = 'Mon to Sat, 7:00 AM to 5:00 PM';

const EVENT_LABEL: Record<StaffAppointmentView['history'][number]['eventType'], string> = {
  assigned: 'Assigned',
  rescheduled: 'Rescheduled',
  remarks_updated: 'Details changed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Date window as one phrase, e.g. "Oct 13, 2026 to Oct 19, 2026". */
export const windowLabel = (appointment: Pick<StaffAppointmentView, 'startDate' | 'endDate'>): string =>
  `${formatDate(appointment.startDate)} to ${formatDate(appointment.endDate)}`;

const isLive = (appointment: Pick<StaffAppointmentView, 'status'>): boolean =>
  appointment.status === 'scheduled' || appointment.status === 'rescheduled';

type Action = 'reschedule' | 'edit' | 'cancel' | null;

function RescheduleForm({
  appointment,
  today,
  onDone,
  onCancel,
}: {
  appointment: StaffAppointmentView;
  today: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState(appointment.startDate);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const end = appointmentEndDate(start);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = startDateProblem(start, today);
    if (problem) {
      setError(problem);
      return;
    }
    if (start === appointment.startDate) {
      setError('That is already the start date.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateAppointment(appointment.id, { startDate: start });
      onDone();
    } catch (caught) {
      setError(toApiError(caught).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 rounded-md border border-line-strong bg-page p-3">
      <h3 className="text-sm font-semibold text-ink">Reschedule</h3>
      <label htmlFor={`start-${appointment.id}`} className="mt-2 block text-sm font-medium text-ink">
        New start date
      </label>
      <input
        id={`start-${appointment.id}`}
        type="date"
        className={`${fieldClass} mt-1 max-w-48`}
        value={start}
        min={today}
        onChange={(event) => setStart(event.target.value)}
      />
      {end ? (
        <p className="mt-1 text-xs text-muted">
          Window: {formatDate(start)} to {formatDate(end)} ({HOURS_NOTE}).
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Saving…' : 'Reschedule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-line-strong bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-page"
        >
          Close
        </button>
      </div>
    </form>
  );
}

function EditForm({ appointment, onDone, onCancel }: { appointment: StaffAppointmentView; onDone: () => void; onCancel: () => void }) {
  const [purpose, setPurpose] = useState(appointment.purpose);
  const [notes, setNotes] = useState(appointment.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (purpose.trim() === '') {
      setError('Enter a purpose.');
      return;
    }
    const input: { purpose?: string; notes?: string } = {};
    if (purpose.trim() !== appointment.purpose) input.purpose = purpose.trim();
    if (notes.trim() !== (appointment.notes ?? '')) input.notes = notes.trim();
    if (Object.keys(input).length === 0) {
      setError('Nothing was changed.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updateAppointment(appointment.id, input);
      onDone();
    } catch (caught) {
      setError(toApiError(caught).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 rounded-md border border-line-strong bg-page p-3">
      <h3 className="text-sm font-semibold text-ink">Edit purpose and notes</h3>
      <label htmlFor={`purpose-${appointment.id}`} className="mt-2 block text-sm font-medium text-ink">
        Purpose
      </label>
      <input
        id={`purpose-${appointment.id}`}
        className={`${fieldClass} mt-1`}
        value={purpose}
        maxLength={1000}
        onChange={(event) => setPurpose(event.target.value)}
      />
      <label htmlFor={`notes-${appointment.id}`} className="mt-2 block text-sm font-medium text-ink">
        Notes (optional)
      </label>
      <textarea
        id={`notes-${appointment.id}`}
        className={`${fieldClass} mt-1 min-h-16`}
        value={notes}
        maxLength={1000}
        onChange={(event) => setNotes(event.target.value)}
      />
      {error ? (
        <p role="alert" className="mt-1 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-line-strong bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-page"
        >
          Close
        </button>
      </div>
    </form>
  );
}

function AppointmentCard({ appointment, today, onChanged }: { appointment: StaffAppointmentView; today: string; onChanged: () => void }) {
  const [action, setAction] = useState<Action>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const live = isLive(appointment);

  const done = (text: string) => {
    setAction(null);
    setNotice({ tone: 'success', text });
    onChanged();
  };

  return (
    <li className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-ink">
            {appointment.student.name} <span className="font-normal text-muted">({appointment.student.id})</span>
            <span className="ml-2 text-xs font-normal text-muted">{appointment.code}</span>
          </div>
          <div className="text-sm text-muted">{windowLabel(appointment)}</div>
        </div>
        <StatusPill status={appointment.status} kind="appointment" />
      </div>
      <p className="mt-2 text-sm text-ink">{appointment.purpose}</p>
      {appointment.notes ? <p className="mt-1 text-sm text-muted">Notes: {appointment.notes}</p> : null}
      {appointment.cancelReason ? <p className="mt-1 text-sm">Reason for cancelling: {appointment.cancelReason}</p> : null}
      <p className="mt-1 text-xs text-muted">Assigned by {appointment.assignedBy}</p>

      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mt-2 text-sm font-medium ${notice.tone === 'error' ? 'text-danger' : 'text-success'}`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {live ? (
          <>
            <button
              type="button"
              className={buttonClass}
              onClick={async () => {
                try {
                  await api.completeAppointment(appointment.id);
                  done('Marked as completed.');
                } catch (error) {
                  setNotice({ tone: 'error', text: toApiError(error).message });
                  onChanged();
                }
              }}
            >
              Mark completed
            </button>
            {(
              [
                ['reschedule', 'Reschedule'],
                ['edit', 'Edit details'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className="rounded-md border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-page"
                onClick={() => setAction(action === key ? null : key)}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="rounded-md border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-page"
              onClick={() => setAction('cancel')}
            >
              Cancel appointment
            </button>
          </>
        ) : null}
        <button
          type="button"
          className="rounded-md px-3 py-2 text-sm font-medium text-primary underline"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((open) => !open)}
        >
          {showHistory ? 'Hide history' : 'History'}
        </button>
      </div>

      {action === 'reschedule' ? (
        <RescheduleForm appointment={appointment} today={today} onDone={() => done('Rescheduled. The student was notified.')} onCancel={() => setAction(null)} />
      ) : null}
      {action === 'edit' ? (
        <EditForm appointment={appointment} onDone={() => done('Saved. The student was notified.')} onCancel={() => setAction(null)} />
      ) : null}
      {action === 'cancel' ? (
        <ReasonForm
          title="Cancel this appointment"
          description="The student is told why."
          label="Reason (required)"
          submitLabel="Cancel appointment"
          onCancel={() => setAction(null)}
          onSubmit={async (reason) => {
            try {
              await api.cancelAppointment(appointment.id, reason);
            } catch (error) {
              throw new Error(toApiError(error).message);
            }
            done('Cancelled. The student was notified.');
          }}
        />
      ) : null}

      {showHistory ? (
        <ol className="mt-3 space-y-1 border-t border-line pt-3 text-sm" aria-label="Appointment history">
          {appointment.history.map((entry, index) => (
            <li key={index}>
              <span className="font-medium text-ink">{EVENT_LABEL[entry.eventType]}</span>{' '}
              <span className="text-muted">
                by {entry.by} · {formatDateTime(entry.date)}
              </span>
              {entry.remarks ? <div className="text-muted">{entry.remarks}</div> : null}
            </li>
          ))}
        </ol>
      ) : null}
    </li>
  );
}

export function StaffAppointmentsPage() {
  const [bucket, setBucket] = useState<'upcoming' | 'history'>('upcoming');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const today = manilaToday();
  const resource = useApi(() => api.staffAppointments({ bucket, q, page }), [bucket, q, page]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQ(search.trim());
  }

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={`Each appointment is a 6-working-day window (${HOURS_NOTE}).`}
        actions={
          <Link to="/appointments/new" className={buttonClass}>
            Make appointment
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-2" role="tablist" aria-label="Appointment list">
          {(['upcoming', 'history'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={bucket === option}
              onClick={() => {
                setPage(1);
                setBucket(option);
              }}
              className={`rounded-full border px-3 py-1 text-sm font-medium ${
                bucket === option ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
              }`}
            >
              {option === 'upcoming' ? 'Upcoming' : 'History'}
            </button>
          ))}
        </div>
        <form onSubmit={submitSearch} className="flex min-w-0 flex-1 gap-2" role="search">
          <label htmlFor="appointment-search" className="sr-only">
            Search appointments
          </label>
          <input
            id="appointment-search"
            type="search"
            placeholder="Search student name, ID or purpose"
            className={fieldClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" className={buttonClass}>
            Search
          </button>
        </form>
      </div>

      <Resource resource={resource} onRetry={resource.reload}>
        {({ appointments, total, pageSize }) => {
          const pages = Math.max(1, Math.ceil(total / pageSize));
          if (appointments.length === 0) {
            return <EmptyState title={bucket === 'upcoming' ? 'No upcoming appointments.' : 'No past appointments.'} />;
          }
          return (
            <>
              <ul className="space-y-3">
                {appointments.map((appointment) => (
                  <AppointmentCard key={appointment.id} appointment={appointment} today={today} onChanged={resource.reload} />
                ))}
              </ul>
              <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
                <button
                  type="button"
                  className="rounded-md border border-line-strong bg-white px-3 py-1.5 font-medium disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span className="text-muted">
                  Page {page} of {pages} · {total} appointments
                </span>
                <button
                  type="button"
                  className="rounded-md border border-line-strong bg-white px-3 py-1.5 font-medium disabled:opacity-50"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </nav>
            </>
          );
        }}
      </Resource>
    </>
  );
}

interface MakeFields {
  studentId: string;
  startDate: string;
  purpose: string;
  notes: string;
}

export function MakeAppointmentPage() {
  const today = manilaToday();
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ studentId: string; window: string } | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MakeFields>({ defaultValues: { studentId: '', startDate: '', purpose: '', notes: '' } });
  const start = watch('startDate');
  const end = appointmentEndDate(start);

  const onSubmit = handleSubmit(async (fields) => {
    setFormError(null);
    setCreated(null);
    try {
      await api.createAppointment({
        studentId: fields.studentId.trim(),
        startDate: fields.startDate,
        purpose: fields.purpose.trim(),
        notes: fields.notes.trim(),
      });
      const finish = appointmentEndDate(fields.startDate);
      setCreated({
        studentId: fields.studentId.trim(),
        window: finish ? `${formatDate(fields.startDate)} to ${formatDate(finish)}` : formatDate(fields.startDate),
      });
      reset({ studentId: '', startDate: '', purpose: '', notes: '' });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
    }
  });

  return (
    <>
      <PageHeader title="Make appointment" subtitle="Give a student a 6-working-day window to visit the SDO office." />
      {created ? (
        <p role="status" className="mb-4 rounded-md border border-success/40 bg-white px-4 py-3 text-sm font-medium text-success">
          Appointment set for {created.studentId}: {created.window}. The student was notified.{' '}
          <Link to="/appointments" className="underline">
            View appointments
          </Link>
        </p>
      ) : null}
      <Card>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="appt-student" className="mb-1 block text-sm font-medium text-ink">
              Student ID
            </label>
            <input
              id="appt-student"
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
            <label htmlFor="appt-start" className="mb-1 block text-sm font-medium text-ink">
              Start date
            </label>
            <input
              id="appt-start"
              type="date"
              min={today}
              className={`${fieldClass} max-w-48`}
              {...register('startDate', { validate: (value) => startDateProblem(value, today) ?? true })}
            />
            {errors.startDate ? <p className="mt-1 text-sm text-danger">{errors.startDate.message}</p> : null}
            {end ? (
              <p className="mt-1 text-sm text-muted">
                The student can visit from {formatDate(start)} to {formatDate(end)} ({HOURS_NOTE}). Sundays are skipped.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">Today up to 60 days ahead, not a Sunday.</p>
            )}
          </div>
          <div>
            <label htmlFor="appt-purpose" className="mb-1 block text-sm font-medium text-ink">
              Purpose
            </label>
            <input
              id="appt-purpose"
              className={fieldClass}
              maxLength={1000}
              {...register('purpose', { required: 'Enter the purpose of the visit.' })}
            />
            {errors.purpose ? <p className="mt-1 text-sm text-danger">{errors.purpose.message}</p> : null}
          </div>
          <div>
            <label htmlFor="appt-notes" className="mb-1 block text-sm font-medium text-ink">
              Notes (optional)
            </label>
            <textarea id="appt-notes" className={`${fieldClass} min-h-20`} maxLength={1000} {...register('notes')} />
          </div>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {formError}
            </p>
          ) : null}
          <button type="submit" disabled={isSubmitting} className={buttonClass}>
            {isSubmitting ? 'Saving…' : 'Set appointment'}
          </button>
        </form>
      </Card>
    </>
  );
}
