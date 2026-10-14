import { useState } from 'react';
import type { StaffAppointmentView } from '@shared/types';
import { StartDateCalendar } from '@/components/appointments/StartDateCalendar';
import { FormModal, useToast } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StudentLookup } from '@/components/ui/StudentLookup';
import { Textarea } from '@/components/ui/Textarea';
import { toApiError } from '@/api/client';
import { appointmentsApi } from '@/api/appointments';
import { useStudentLookup } from '@/hooks/useStudentLookup';
import { ordinalYear } from '@/utils/account';
import { appointmentToasts, formErrors, overlapMessage, reviewNote, reviewRows, startDateError, studentMeta } from '@/utils/appointments';
import { manilaToday } from '@/utils/files';
import { dayRange } from '@/utils/staffDashboard';
import { appointmentEndDate } from '@/utils/workingDays';

type Errors = { student?: string; date?: string; reason?: string; overlap?: string };

/**
 * Make appointment and Edit appointment as a dialog over Appointments (deck W38 to W43): the edit step, then the
 * review step, inside one modal. Edit changes the reason, the remarks or the start date (a new date reschedules);
 * the API checks everything again, including overlaps.
 */
export function AppointmentModal({
  editing,
  onClose,
  onSaved,
}: {
  editing: StaffAppointmentView | null;
  onClose: () => void;
  /** The appointment was created or changed; the page reloads and selects it. */
  onSaved: (appointmentId: number) => void;
}) {
  const toast = useToast();
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
      const others = await appointmentsApi.staffAppointments({ bucket: 'upcoming', q: student.id });
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
        const { appointmentId } = await appointmentsApi.createAppointment({ studentId: student.id, startDate, purpose: reason.trim(), notes: remarks.trim() });
        const created = await appointmentsApi.staffAppointment(appointmentId).catch(() => null);
        toast.show(appointmentToasts(created?.appointment.code ?? 'The appointment', student.name).assigned, 'success');
        onSaved(appointmentId);
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
        await appointmentsApi.updateAppointment(editing.id, changes);
        toast.show(moved ? toasts.moved(startDate) : toasts.updated, 'success');
      }
      onSaved(editing.id);
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

  const reviewing = step === 'review';

  return (
    <FormModal
      open
      icon={editing ? 'edit_calendar' : 'event_available'}
      title={editing ? 'Edit appointment' : 'Make appointment'}
      subtitle={
        reviewing
          ? 'Review the details before saving.'
          : editing
            ? `Editing ${editing.code}. Change the date to reschedule.`
            : 'Monday to Saturday, 7:00 AM to 5:00 PM.'
      }
      busy={saving}
      onClose={onClose}
      maxWidth="max-w-[640px]"
      footer={
        reviewing ? (
          <>
            <Button variant="secondary" size="lg" disabled={saving} onClick={() => setStep('edit')}>
              Back to edit
            </Button>
            <Button size="lg" busy={saving} onClick={() => void save()}>
              {editing ? 'Save changes' : 'Save and assign'}
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button size="lg" busy={checking} busyLabel="Checking…" onClick={() => void review()}>
              Review appointment
            </Button>
          </>
        )
      }
    >
      {reviewing ? (
        <div className="flex flex-col gap-3">
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
      ) : (
        <div className="flex flex-col gap-5">
          {editing && student ? (
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
              <Icon name="person_check" className="!text-lg" />
              {student.name} · {student.meta}
            </p>
          ) : (
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
          />
          <Textarea
            label="Remarks for the student (optional)"
            rows={2}
            maxLength={1000}
            placeholder="e.g. Bring your school ID."
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
          />
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
            {errors.date ? (
              <p role="alert" className="mt-2 flex items-center gap-1.5 text-[13px] font-semibold text-danger-strong">
                <Icon name="error" className="!text-[18px]" />
                {errors.date}
              </p>
            ) : null}
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
      )}
    </FormModal>
  );
}
