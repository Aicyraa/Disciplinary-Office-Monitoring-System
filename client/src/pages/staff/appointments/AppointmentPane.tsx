import { useState } from 'react';
import type { StaffAppointmentView } from '@shared/types';
import { ConfirmModal, useToast } from '@/components/feedback';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { DetailTable } from '@/components/ui/DetailTable';
import { HistoryList } from '@/components/ui/HistoryList';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { appointmentHistory, appointmentToasts, lastUpdated, studentMeta, whenText } from '@/utils/appointments';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';
import { dayRange } from '@/utils/staffDashboard';

/** The right pane (deck W36, W37): window as the title, Details / History, the update footer. */
export function AppointmentPane({
  appointmentId,
  onChanged,
  onEdit,
}: {
  appointmentId: number;
  onChanged: () => void;
  /** Opens the Edit appointment dialog for this appointment. */
  onEdit: (appointment: StaffAppointmentView) => void;
}) {
  const toast = useToast();
  const resource = useApi(() => api.staffAppointment(appointmentId), [appointmentId]);
  const [tab, setTab] = useState<'details' | 'history'>('details');
  const [modal, setModal] = useState<'complete' | 'cancel' | null>(null);

  if (resource.status === 'loading') {
    return (
      <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-line bg-white text-[13px] text-muted">
        <Spinner />
        Loading appointment…
      </div>
    );
  }
  if (resource.status === 'error') {
    return (
      <div className="rounded-xl border border-line bg-white">
        <PageError page="this appointment" detail={resource.error.message} onRetry={resource.reload} />
      </div>
    );
  }
  const a = resource.data.appointment;
  const live = a.status === 'scheduled' || a.status === 'rescheduled';
  const toasts = appointmentToasts(a.code, a.student.name);
  const meta = studentMeta(a);
  const finish = (text: string) => {
    setModal(null);
    toast.show(text, 'success');
    resource.reload();
    onChanged();
  };

  return (
    <article aria-label={`Appointment ${a.code}`} className="flex min-h-full flex-col gap-5 rounded-xl border border-line bg-white p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] leading-tight font-bold text-pretty text-ink">{dayRange(a.startDate, a.endDate)}</h2>
          <p className="mt-1.5 text-sm text-body">
            <span className="font-semibold">{a.student.name}</span>
            <span className="text-muted"> · {a.student.id}</span>
          </p>
        </div>
        <StatusPill status={a.status} kind="appointment" />
      </header>

      <SegmentedTabs
        label="Appointment sections"
        options={[
          { value: 'details', label: 'Details' },
          { value: 'history', label: 'History', count: a.history.length },
        ]}
        value={tab}
        onChange={(value) => setTab(value as 'details' | 'history')}
        className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
      />

      {tab === 'details' ? (
        <DetailTable
          rows={[
            {
              label: 'Student',
              value: (
                <>
                  {a.student.name}
                  {meta ? <span className="block text-[13px] text-muted">{meta}</span> : null}
                </>
              ),
            },
            { label: 'Reason', value: a.purpose },
            { label: 'Remarks for the student', value: a.notes || 'None' },
            ...(a.cancelReason ? [{ label: 'Reason for cancelling', value: a.cancelReason }] : []),
            { label: 'Appointment ID', value: a.code },
            { label: 'Created', value: formatDate(a.dateCreated) },
            { label: 'Last updated', value: lastUpdated(a) },
          ]}
        />
      ) : (
        <HistoryList items={appointmentHistory(a)} />
      )}

      {tab === 'details' ? (
        <div className="-mx-6 mt-auto -mb-6 flex flex-col gap-3 rounded-b-xl border-t border-line-soft bg-surface-2 px-6 pt-4 pb-5">
          {live ? (
            <>
              <p className="text-sm font-semibold text-ink">Update this appointment</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="success" size="xl" className="flex-[1_1_200px]" onClick={() => setModal('complete')}>
                  <Icon name="event_available" className="!text-xl" />
                  Mark completed
                </Button>
                <Button variant="secondary" size="xl" className="flex-[1_1_200px]" onClick={() => onEdit(a)}>
                  <Icon name="edit_calendar" className="!text-xl" />
                  Edit or reschedule
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setModal('cancel')}
                className="inline-flex min-h-11 items-center gap-1.5 self-center rounded-full px-3 text-[13px] font-semibold text-danger outline-none hover:bg-danger-soft focus-visible:ring-[3px] focus-visible:ring-danger/25 rail:min-h-9"
              >
                <Icon name="event_busy" className="!text-lg" />
                Cancel this appointment
              </button>
            </>
          ) : (
            <p role="status" className={cn('flex items-center gap-2 text-sm font-semibold', a.status === 'completed' ? 'text-success' : 'text-neutral-ink')}>
              <Icon name={a.status === 'completed' ? 'check_circle' : 'event_busy'} className="!text-xl" />
              {a.status === 'completed'
                ? `Completed on ${lastUpdated(a)}. Kept on file for history.`
                : `Cancelled on ${lastUpdated(a)}. The slot is open again.`}
            </p>
          )}
        </div>
      ) : null}

      <ConfirmModal
        open={modal === 'complete'}
        tone="ok"
        title={`Mark ${a.code} as completed?`}
        description={`${a.student.name} attended the appointment on ${whenText(a)}. The student is notified.`}
        confirmLabel="Mark completed"
        onClose={() => setModal(null)}
        onConfirm={async () => {
          try {
            await api.completeAppointment(a.id);
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
          finish(toasts.completed);
        }}
      />
      <ConfirmModal
        open={modal === 'cancel'}
        tone="danger"
        title={`Cancel ${a.code}?`}
        description={`The appointment with ${a.student.name} on ${whenText(a)} is cancelled and the slot opens up again. The student is notified.`}
        reasonLabel="Reason for cancelling (shown to the student)"
        reasonPlaceholder="e.g. The officer is out of the office that day."
        confirmLabel="Cancel appointment"
        cancelLabel="Keep appointment"
        onClose={() => setModal(null)}
        onConfirm={async (reason) => {
          try {
            await api.cancelAppointment(a.id, reason);
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
          finish(toasts.cancelled);
        }}
      />
    </article>
  );
}
