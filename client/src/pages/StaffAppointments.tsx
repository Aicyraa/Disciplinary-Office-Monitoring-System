import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { StaffAppointmentView } from '@shared/types';
import { ConfirmModal, useToast } from '../components/feedback';
import { MasterDetail } from '../components/MasterDetail';
import { Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, StatusPill, buttonClass, fieldClass } from '../components/ui';
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

type Tab = 'details' | 'history';

function AppointmentDetail({ appointment, today, onChanged }: { appointment: StaffAppointmentView; today: string; onChanged: () => void }) {
  const toast = useToast();
  const [action, setAction] = useState<Action | 'complete'>(null);
  const [tab, setTab] = useState<Tab>('details');
  const live = isLive(appointment);

  const done = (text: string) => {
    setAction(null);
    toast.show(text, 'success');
    onChanged();
  };

  const rows: Array<[string, string]> = [
    ['Student', `${appointment.student.name} · ${appointment.student.id}`],
    ['Reason', appointment.purpose],
    ['Remarks for the student', appointment.notes ?? 'None'],
    ['Appointment ID', appointment.code],
    ['Created', formatDate(appointment.dateCreated)],
    ['Assigned by', appointment.assignedBy],
  ];
  if (appointment.cancelReason) rows.push(['Reason for cancelling', appointment.cancelReason]);

  return (
    <article aria-label={`Appointment ${appointment.code}`} className="rounded-lg border border-line bg-white">
      <div className="space-y-4 p-4">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-ink">{windowLabel(appointment)}</h2>
            <p className="text-sm text-muted">
              <Link to={`/students/${appointment.student.id}`} className="font-medium text-primary underline">
                {appointment.student.name}
              </Link>{' '}
              · {appointment.student.id}
            </p>
          </div>
          <StatusPill status={appointment.status} kind="appointment" />
        </header>

        <div className="flex rounded-full bg-page p-1" role="tablist" aria-label="Appointment sections">
          {(['details', 'history'] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={tab === option}
              onClick={() => setTab(option)}
              className={`min-h-11 flex-1 rounded-full text-sm font-medium ${tab === option ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
            >
              {option === 'details' ? 'Details' : 'History'}
            </button>
          ))}
        </div>

        {tab === 'details' ? (
          <dl className="rounded-lg border border-line">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[8rem_1fr] gap-2 border-b border-line px-3 py-2 last:border-0">
                <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
                <dd className="text-sm text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <ol className="space-y-2 border-l-2 border-line pl-4 text-sm" aria-label="Appointment history">
            {[...appointment.history].reverse().map((entry, index) => (
              <li key={index}>
                <span className="font-medium text-ink">{EVENT_LABEL[entry.eventType]}</span>{' '}
                <span className="text-muted">
                  by {entry.by} · {formatDateTime(entry.date)}
                </span>
                {entry.remarks ? <div className="text-muted">{entry.remarks}</div> : null}
              </li>
            ))}
          </ol>
        )}

        {action === 'reschedule' ? (
          <RescheduleForm appointment={appointment} today={today} onDone={() => done('Rescheduled. The student was notified.')} onCancel={() => setAction(null)} />
        ) : null}
        {action === 'edit' ? (
          <EditForm appointment={appointment} onDone={() => done('Saved. The student was notified.')} onCancel={() => setAction(null)} />
        ) : null}
      </div>

      {live ? (
        <div className="space-y-2 border-t border-line bg-page/60 p-4">
          <p className="text-xs font-semibold text-ink">Update this appointment</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-success px-4 text-sm font-semibold text-white hover:brightness-95"
              onClick={() => setAction('complete')}
            >
              <Icon name="event_available" className="text-base" />
              Mark completed
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-primary px-4 text-sm font-semibold text-primary hover:bg-white"
              onClick={() => setAction(action === 'reschedule' ? null : 'reschedule')}
            >
              <Icon name="edit_calendar" className="text-base" />
              Reschedule
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-page"
              onClick={() => setAction(action === 'edit' ? null : 'edit')}
            >
              Edit details
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-danger underline"
              onClick={() => setAction('cancel')}
            >
              Cancel this appointment
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={action === 'complete'}
        title="Mark as completed?"
        description={`${appointment.student.name} is notified that the visit was completed.`}
        confirmLabel="Mark completed"
        onClose={() => setAction(null)}
        onConfirm={async () => {
          try {
            await api.completeAppointment(appointment.id);
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
          done('Marked as completed.');
        }}
      />
      <ConfirmModal
        open={action === 'cancel'}
        title="Cancel this appointment"
        description="The student is told why."
        reasonLabel="Reason (required)"
        confirmLabel="Cancel appointment"
        danger
        onClose={() => setAction(null)}
        onConfirm={async (reason) => {
          try {
            await api.cancelAppointment(appointment.id, reason);
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
          done('Cancelled. The student was notified.');
        }}
      />
    </article>
  );
}

function AppointmentGroup({ title, total, rows, selectedId }: { title: string; total: number; rows: StaffAppointmentView[]; selectedId: number | null }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <p className="flex items-center gap-2 bg-page px-3 py-1.5 text-[11px] font-bold tracking-wide text-muted uppercase">
        {title}
        <span className="font-normal normal-case">{total}</span>
      </p>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              to={`/appointments/${row.id}`}
              aria-current={row.id === selectedId ? 'page' : undefined}
              className={`block min-h-16 border-b border-line px-3 py-2 hover:bg-page ${row.id === selectedId ? 'bg-primary/10' : ''}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0 text-sm font-semibold text-ink">
                  {row.student.name} <span className="font-normal text-muted">{row.student.id}</span>
                </span>
                <StatusPill status={row.status} kind="appointment" />
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <Icon name="schedule" className="text-sm" />
                {windowLabel(row)}
              </span>
              <span className="block truncate text-xs text-muted">
                {row.code} · {row.purpose}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AppointmentQueue({ selectedId, reloadRef }: { selectedId: number | null; reloadRef: MutableRefObject<(() => void) | null> }) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const upcoming = useApi(() => api.staffAppointments({ bucket: 'upcoming', q }), [q]);
  const past = useApi(() => api.staffAppointments({ bucket: 'history', q }), [q]);

  useEffect(() => {
    reloadRef.current = () => {
      upcoming.reload();
      past.reload();
    };
  });

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setQ(search.trim());
  }

  const loading = upcoming.status === 'loading' || past.status === 'loading';
  const failed = upcoming.status === 'error' ? upcoming : past.status === 'error' ? past : null;
  const up = upcoming.status === 'ready' ? upcoming.data : null;
  const old = past.status === 'ready' ? past.data : null;

  return (
    <section aria-label="Appointments" className="rounded-lg border border-line bg-white">
      <form onSubmit={submitSearch} role="search" className="flex gap-2 border-b border-line p-3">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search appointments</span>
          <Icon name="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Student name, ID or purpose"
            className={`${fieldClass} min-h-11 pl-10`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button type="submit" className={`${buttonClass} min-h-11`}>
          Search
        </button>
      </form>
      {loading ? <LoadingState label="Loading appointments…" cards={3} /> : null}
      {failed && failed.status === 'error' ? (
        <ErrorState
          message={failed.error.message}
          onRetry={() => {
            upcoming.reload();
            past.reload();
          }}
        />
      ) : null}
      {up && old ? (
        up.appointments.length === 0 && old.appointments.length === 0 ? (
          <div className="p-3">
            <EmptyState title="No appointments match." hint="Make an appointment to give a student a visit window." />
          </div>
        ) : (
          <>
            <AppointmentGroup title="Upcoming" total={up.total} rows={up.appointments} selectedId={selectedId} />
            <AppointmentGroup title="Past and closed" total={old.total} rows={old.appointments} selectedId={selectedId} />
            {up.total > up.appointments.length || old.total > old.appointments.length ? (
              <p className="px-3 py-2 text-xs text-muted">Showing the newest. Search to find an older appointment.</p>
            ) : null}
          </>
        )
      ) : null}
    </section>
  );
}

function SelectedAppointment({ appointmentId, onChanged }: { appointmentId: number; onChanged: () => void }) {
  const today = manilaToday();
  // The list endpoint carries the history, so a selected appointment is read from the same two lists.
  const upcoming = useApi(() => api.staffAppointments({ bucket: 'upcoming' }), []);
  const past = useApi(() => api.staffAppointments({ bucket: 'history' }), []);
  if (upcoming.status === 'loading' || past.status === 'loading') return <LoadingState label="Loading appointment…" cards={2} />;
  if (upcoming.status === 'error') return <ErrorState message={upcoming.error.message} onRetry={upcoming.reload} />;
  if (past.status === 'error') return <ErrorState message={past.error.message} onRetry={past.reload} />;
  const all = [...upcoming.data.appointments, ...past.data.appointments];
  const found = all.find((item) => item.id === appointmentId);
  if (!found) return <ErrorState message="This appointment is not in the newest list. Search for it." />;
  return (
    <AppointmentDetail
      appointment={found}
      today={today}
      onChanged={() => {
        upcoming.reload();
        past.reload();
        onChanged();
      }}
    />
  );
}

/** Staff Appointments (deck W36 to W39): grouped list on the left, the selected appointment on the right. */
export function StaffAppointmentsPage() {
  const { id } = useParams();
  const selectedId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const reloadQueue = useRef<(() => void) | null>(null);

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={`Each appointment is a 6-working-day window (${HOURS_NOTE}).`}
        actions={
          <Link to="/appointments/new" className={`${buttonClass} min-h-11`}>
            Make appointment
          </Link>
        }
      />
      <MasterDetail
        list={<AppointmentQueue selectedId={selectedId} reloadRef={reloadQueue} />}
        detail={selectedId === null ? null : <SelectedAppointment key={selectedId} appointmentId={selectedId} onChanged={() => reloadQueue.current?.()} />}
        emptyDetail={<EmptyState title="Select an appointment" hint="Complete, reschedule or cancel it here." />}
        backTo="/appointments"
        backLabel="All appointments"
      />
    </>
  );
}

interface MakeFields {
  studentId: string;
  startDate: string;
  purpose: string;
  notes: string;
}

const EMPTY_FIELDS: MakeFields = { studentId: '', startDate: '', purpose: '', notes: '' };

/** Make appointment: fill the form, review the summary, then save and assign (deck W40 to W43). */
export function MakeAppointmentPage() {
  const today = manilaToday();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [fields, setFields] = useState<MakeFields>(EMPTY_FIELDS);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [studentName, setStudentName] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MakeFields>({ defaultValues: EMPTY_FIELDS });
  const start = watch('startDate');
  const end = appointmentEndDate(start);

  // Review needs the student's name; an unknown ID is caught here, before the officer presses save.
  const onReview = handleSubmit(async (values) => {
    setFormError(null);
    const studentId = values.studentId.trim();
    try {
      const record = await api.student(studentId);
      setStudentName(`${record.profile.firstName} ${record.profile.lastName}`);
      setFields({ ...values, studentId, purpose: values.purpose.trim(), notes: values.notes.trim() });
      setStep('review');
    } catch (error) {
      const message = error instanceof ApiError && error.status === 404 ? 'No student has that ID.' : toApiError(error).message;
      setError('studentId', { message });
    }
  });

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      await api.createAppointment({
        studentId: fields.studentId,
        startDate: fields.startDate,
        purpose: fields.purpose,
        notes: fields.notes,
      });
      toast.show(`Appointment assigned to ${studentName ?? fields.studentId}. They were notified.`, 'success');
      navigate('/appointments');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  }

  if (step === 'review') {
    const finish = appointmentEndDate(fields.startDate);
    const rows: Array<[string, string]> = [
      ['Student', studentName ?? fields.studentId],
      ['Student ID', fields.studentId],
      ['Dates', finish ? `${formatDate(fields.startDate)} to ${formatDate(finish)}` : formatDate(fields.startDate)],
      ['Time', `Any time during office hours, ${HOURS_NOTE}`],
      ['Reason', fields.purpose],
      ['Remarks', fields.notes || 'None'],
      ['Status', 'Scheduled'],
    ];
    return (
      <>
        <PageHeader title="Make appointment" subtitle="Review the appointment before it is assigned." />
        <Card>
          <h2 className="mb-3 text-xs font-bold tracking-wide text-muted uppercase">Review before saving</h2>
          <dl className="rounded-lg border border-line">
            {rows.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[7rem_1fr] gap-2 border-b border-line px-3 py-2 last:border-0">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="text-sm text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">
            Saving assigns this appointment to {studentName ?? fields.studentId}. They get a portal notification and an email.
          </p>
          {formError ? (
            <p role="alert" className="mt-2 text-sm font-medium text-danger">
              {formError}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={() => setStep('edit')}
              className="inline-flex min-h-11 items-center rounded-md border border-primary px-4 text-sm font-semibold text-primary hover:bg-page disabled:opacity-60"
            >
              Back to edit
            </button>
            <button type="button" disabled={saving} onClick={() => void save()} className={`${buttonClass} min-h-11`}>
              {saving ? 'Saving…' : 'Save and assign'}
            </button>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Make appointment" subtitle="Give a student a 6-working-day window to visit the SDO office." />
      <Card>
        <form onSubmit={onReview} className="space-y-4" noValidate>
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
              Reason
            </label>
            <input
              id="appt-purpose"
              className={fieldClass}
              maxLength={1000}
              {...register('purpose', { required: 'Enter the reason for the visit.' })}
            />
            {errors.purpose ? <p className="mt-1 text-sm text-danger">{errors.purpose.message}</p> : null}
          </div>
          <div>
            <label htmlFor="appt-notes" className="mb-1 block text-sm font-medium text-ink">
              Remarks for the student (optional)
            </label>
            <textarea id="appt-notes" className={`${fieldClass} min-h-20`} maxLength={1000} {...register('notes')} />
          </div>
          {formError ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {formError}
            </p>
          ) : null}
          <button type="submit" disabled={isSubmitting} className={`${buttonClass} min-h-11`}>
            {isSubmitting ? 'Checking…' : 'Review'}
          </button>
        </form>
      </Card>
    </>
  );
}
