import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { StaffAppointmentView } from '@shared/types';
import { StartDateCalendar } from '@/components/appointments/StartDateCalendar';
import { useToast } from '@/components/feedback';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { StudentLookup } from '@/components/ui/StudentLookup';
import { Textarea } from '@/components/ui/Textarea';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { useStudentLookup } from '@/hooks/useStudentLookup';
import { ordinalYear } from '@/utils/account';
import {
  appointmentToasts,
  formErrors,
  overlapMessage,
  reviewNote,
  reviewRows,
  startDateError,
  studentMeta,
} from '@/utils/appointments';
import { appointmentEndDate } from '@/utils/workingDays';
import { manilaToday } from '@/utils/files';
import { dayRange } from '@/utils/staffDashboard';

type Errors = { student?: string; date?: string; reason?: string; overlap?: string };

function FieldError({ children }: { children?: string }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-danger">
      <Icon name="error" className="!text-lg" />
      {children}
    </p>
  );
}

/**
 * Make appointment and Edit appointment (deck W38 to W43): the list is hidden and the form fills the page.
 * Edit changes the reason, the remarks or the start date (a new date reschedules); the API checks everything.
 */
function AppointmentFormCard({ editing }: { editing: StaffAppointmentView | null }) {
  const toast = useToast();
  const navigate = useNavigate();
  const today = manilaToday();
  const [studentId, setStudentId] = useState('');
  const { lookup, profile } = useStudentLookup(studentId);
  const [startDate, setStartDate] = useState(editing?.startDate ?? '');
  const [reason, setReason] = useState(editing?.purpose ?? '');
  const [remarks, setRemarks] = useState(editing?.notes ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const student = editing
    ? { id: editing.student.id, name: editing.student.name, meta: [editing.student.id, studentMeta(editing)].filter(Boolean).join(' · ') }
    : profile
      ? { id: profile.studentId, name: `${profile.firstName} ${profile.lastName}`, meta: `${profile.studentId} · ${profile.program} · ${ordinalYear(profile.yearLevel)}` }
      : null;
  const moved = editing !== null && startDate !== editing.startDate;
  const kind: 'new' | 'moved' | 'edited' = editing === null ? 'new' : moved ? 'moved' : 'edited';
  const status = editing === null ? 'Scheduled' : moved ? 'Rescheduled' : editing.status === 'rescheduled' ? 'Rescheduled' : 'Scheduled';
  const cancelTo = editing ? `/appointments/${editing.id}` : '/appointments';

  async function review() {
    const found = formErrors({ studentFound: student !== null, studentTyped: editing ? editing.student.id : studentId, startDate, reason }, today);
    if (Object.keys(found).length > 0 || !student) {
      setErrors(found);
      return;
    }
    // The overlap check the deck makes before review; the API's exclusion constraint still decides on save.
    setChecking(true);
    try {
      const end = appointmentEndDate(startDate) ?? startDate;
      const others = await api.staffAppointments({ bucket: 'upcoming', q: student.id });
      const clash = others.appointments.find(
        (other) => other.student.id === student.id && other.id !== editing?.id && other.startDate <= end && other.endDate >= startDate,
      );
      if (clash) {
        setErrors({ overlap: overlapMessage(student.name, clash) });
        return;
      }
    } catch {
      // The check is a courtesy; saving still runs the real one.
    } finally {
      setChecking(false);
    }
    setErrors({});
    setStep('review');
  }

  async function save() {
    if (!student) return;
    setSaving(true);
    try {
      if (editing === null) {
        const { appointmentId } = await api.createAppointment({ studentId: student.id, startDate, purpose: reason.trim(), notes: remarks.trim() });
        const created = await api.staffAppointment(appointmentId).catch(() => null);
        toast.show(appointmentToasts(created?.appointment.code ?? 'The appointment', student.name).assigned, 'success');
        navigate(`/appointments/${appointmentId}`);
        return;
      }
      const changes: { startDate?: string; purpose?: string; notes?: string } = {};
      if (moved) changes.startDate = startDate;
      if (reason.trim() !== editing.purpose) changes.purpose = reason.trim();
      if (remarks.trim() !== (editing.notes ?? '')) changes.notes = remarks.trim();
      const toasts = appointmentToasts(editing.code, student.name);
      if (Object.keys(changes).length === 0) {
        toast.show('No changes to save.', 'info');
      } else {
        await api.updateAppointment(editing.id, changes);
        toast.show(moved ? toasts.moved(startDate) : toasts.updated, 'success');
      }
      navigate(`/appointments/${editing.id}`);
    } catch (error) {
      const failure = toApiError(error);
      setSaving(false);
      if (failure.code === 'appointment_overlap') {
        setErrors({ overlap: failure.message });
        setStep('edit');
        return;
      }
      toast.show(failure.message, 'error');
    }
  }

  return (
    <section className="flex min-h-[calc(100vh-128px)] flex-col gap-[22px] rounded-xl border border-line bg-white p-6">
      {editing ? (
        <p className="flex items-center gap-2.5 rounded-[10px] bg-info-soft px-3.5 py-2.5 text-sm text-ink">
          <Icon name="edit_calendar" className="!text-xl text-primary" />
          <span>
            Editing <strong>{editing.code}</strong>. Change the date to reschedule.
          </span>
        </p>
      ) : null}

      {step === 'edit' ? (
        <>
          <div className="@container flex flex-wrap items-start gap-x-8 gap-y-6">
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-[22px]">
              <div className="flex flex-col gap-3">
                <SectionLabel index={1}>Student</SectionLabel>
                {editing ? null : (
                  <StudentLookup
                    label="Student ID"
                    placeholder="e.g. 2025-1234567"
                    value={studentId}
                    onChange={(value) => {
                      setStudentId(value);
                      setErrors((current) => ({ ...current, student: undefined, overlap: undefined }));
                    }}
                    lookup={lookup}
                    error={errors.student && lookup.status !== 'not_found' ? errors.student : undefined}
                    autoComplete="off"
                  />
                )}
                {editing && student ? (
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
                    <Icon name="person_check" className="!text-lg" />
                    {student.name} · {student.meta}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-3">
                <SectionLabel index={2}>Details</SectionLabel>
                <Textarea
                  label="Reason for the appointment"
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. Interview about case SDO-2026-012"
                  value={reason}
                  error={errors.reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setErrors((current) => ({ ...current, reason: undefined }));
                  }}
                  className="min-h-[140px]"
                />
                <Textarea
                  label="Remarks for the student (optional)"
                  rows={2}
                  maxLength={1000}
                  placeholder="e.g. Bring your school ID."
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  className="min-h-[72px]"
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-[0_1_400px] flex-col gap-3">
              <SectionLabel index={3}>Schedule</SectionLabel>
              <div>
                <p className="mb-1.5 text-[13px] font-semibold text-ink">Start date</p>
                <StartDateCalendar
                  value={startDate}
                  today={today}
                  invalid={Boolean(errors.date || errors.overlap)}
                  onChange={(date) => {
                    setStartDate(date);
                    setErrors((current) => ({ ...current, date: undefined, overlap: undefined }));
                  }}
                />
                <FieldError>{errors.date}</FieldError>
                {startDate && !startDateError(startDate, today) ? (
                  <p className="mt-1.5 text-xs text-muted">
                    The student can visit any day from {dayRange(startDate, appointmentEndDate(startDate) ?? startDate)}, 7:00 AM to 5:00 PM.
                  </p>
                ) : null}
              </div>
              {errors.overlap ? (
                <p role="alert" className="flex items-center gap-2.5 rounded-[10px] bg-danger-soft px-3.5 py-3 text-[13px] text-pretty text-danger-ink">
                  <Icon name="event_busy" className="!text-xl" />
                  {errors.overlap}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-auto flex justify-end border-t border-line-soft pt-[18px]">
            <div className="flex flex-row-reverse flex-wrap items-center gap-2.5">
              <Button size="lg" busy={checking} busyLabel="Checking…" onClick={() => void review()}>
                Review appointment
              </Button>
              <Button variant="secondary" size="lg" onClick={() => navigate(cancelTo)}>
                Cancel
              </Button>
              <span className="text-[13px] font-semibold text-muted">Monday to Saturday, 7:00 AM to 5:00 PM</span>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <SectionLabel>Review before saving</SectionLabel>
            <dl className="rounded-[10px] border border-calendar-closed bg-surface-2 px-4 py-0.5">
              {student
                ? reviewRows({ name: student.name, studentId: student.id, startDate, reason, remarks, status }).map(([label, value]) => (
                    <div key={label} className="flex flex-wrap gap-x-4 gap-y-1 border-b border-line-soft py-2.5 last:border-b-0">
                      <dt className="flex-[0_0_150px] text-[13px] font-semibold text-muted">{label}</dt>
                      <dd className="min-w-0 flex-[1_1_200px] text-sm text-pretty text-ink">{value}</dd>
                    </div>
                  ))
                : null}
            </dl>
            <p className="text-[13px] text-pretty text-muted">{student ? reviewNote(kind, student.name) : null}</p>
          </div>
          <div className="mt-auto flex justify-end border-t border-line-soft pt-[18px]">
            <div className="flex flex-row-reverse flex-wrap items-center gap-2.5">
              <Button size="lg" busy={saving} onClick={() => void save()}>
                {editing ? 'Save changes' : 'Save and assign'}
              </Button>
              <Button variant="secondary" size="lg" disabled={saving} onClick={() => setStep('edit')}>
                Back to edit
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

/** `/appointments/new` (deck W38): breadcrumb "Staff › Make appointment". */
export function MakeAppointmentPage() {
  return (
    <>
      <h1 className="sr-only">Make appointment</h1>
      <AppointmentFormCard editing={null} />
    </>
  );
}

/** `/appointments/:id/edit` (deck W41): breadcrumb "Staff › Edit appointment". */
export function EditAppointmentPage() {
  const { id } = useParams();
  const appointmentId = /^\d+$/.test(id ?? '') ? Number(id) : 0;
  const resource = useApi(() => api.staffAppointment(appointmentId), [appointmentId]);
  return (
    <>
      <h1 className="sr-only">Edit appointment</h1>
      {resource.status === 'loading' ? (
        <p role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-line bg-white text-[13px] text-muted">
          <Spinner />
          Loading the appointment…
        </p>
      ) : null}
      {resource.status === 'error' ? (
        <div className="rounded-xl border border-line bg-white">
          <PageError page="this appointment" detail={resource.error.message} onRetry={resource.reload} />
        </div>
      ) : null}
      {resource.status === 'ready' ? (
        resource.data.appointment.status === 'scheduled' || resource.data.appointment.status === 'rescheduled' ? (
          <AppointmentFormCard editing={resource.data.appointment} />
        ) : (
          <div className="rounded-xl border border-line bg-white">
            <PageError page="this appointment" detail="Completed and cancelled appointments cannot be edited." />
          </div>
        )
      ) : null}
    </>
  );
}
