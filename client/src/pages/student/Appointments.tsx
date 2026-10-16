import { useState } from 'react';
import { useParams } from 'react-router-dom';
import type { StudentAppointmentView } from '@shared/types';
import { PageError } from '@/components/feedback/PageState';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { StatusPill } from '@/components/ui';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { meApi } from '@/api/me';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';
import { dayRange } from '@/utils/staffDashboard';

type Tab = 'upcoming' | 'history';

const dayParts = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`);
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(date);
  return { dow: part({ weekday: 'short' }), day: date.getUTCDate(), mon: part({ month: 'short' }) };
};

function AppointmentCard({ appointment, selected }: { appointment: StudentAppointmentView; selected: boolean }) {
  const upcoming = appointment.bucket === 'upcoming';
  const parts = dayParts(appointment.startDate);
  const cancelled = appointment.status === 'cancelled' && appointment.cancelReason;
  const remarks = cancelled ? appointment.cancelReason : appointment.notes;
  return (
    <article
      aria-label={`Appointment ${appointment.code}`}
      className={cn('flex items-start gap-5 rounded-xl border bg-white p-5', selected ? 'border-primary ring-[3px] ring-primary/18' : 'border-line')}
    >
      {/* The date tile holds the left column on its own; everything else sits in the column beside it. */}
      <div
        aria-hidden="true"
        className={cn(
          'grid size-[88px] shrink-0 place-content-center rounded-[10px] text-center',
          upcoming ? 'bg-primary text-white' : 'bg-line-soft text-neutral-ink',
        )}
      >
        <div className="text-xs font-semibold tracking-[0.04em] uppercase">{parts.dow}</div>
        <div className="text-[28px] leading-tight font-extrabold">{parts.day}</div>
        <div className="text-xs font-semibold">{parts.mon}</div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-bold text-ink">{dayRange(appointment.startDate, appointment.endDate)}</p>
            <p className="text-[13px] text-muted">Visit any day · 7:00 AM to 5:00 PM</p>
          </div>
          <StatusPill status={appointment.status} kind="appointment" />
        </div>
        <div>
          <p className="text-xs font-semibold text-muted">Reason</p>
          <p className="text-sm text-pretty wrap-anywhere text-ink">{appointment.purpose}</p>
        </div>
        {remarks ? (
          <div className="rounded-lg border border-line-soft bg-surface-2 px-3 py-2.5">
            <p className="text-xs font-semibold text-muted">{cancelled ? 'Reason for cancelling' : 'Remarks from the SDO'}</p>
            <p className="text-sm text-pretty wrap-anywhere text-ink">{remarks}</p>
          </div>
        ) : null}
        <p className="text-xs text-muted">
          {appointment.code} · Updated {formatDate(appointment.dateUpdated)}
        </p>
      </div>
    </article>
  );
}

/** Student Appointments (deck W77, W78; src 1672 to 1691): Upcoming / History tabs, one card per appointment. */
export function AppointmentsPage() {
  const { id } = useParams();
  const selectedId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const resource = useApi(() => meApi.myAppointments(), []);
  const [chosen, setChosen] = useState<Tab | null>(null);

  if (resource.status === 'loading') {
    return (
      <SkeletonList label="Loading your appointments…" className="px-0" />
    );
  }
  if (resource.status === 'error') return <PageError page="Appointments" detail={resource.error.message} onRetry={resource.reload} />;

  const all = resource.data.appointments;
  const upcoming = all.filter((a) => a.bucket === 'upcoming').sort((a, b) => a.startDate.localeCompare(b.startDate));
  const history = all.filter((a) => a.bucket === 'history').sort((a, b) => b.startDate.localeCompare(a.startDate));
  // A link to one appointment (dashboard, bell) opens the tab that holds it.
  const linked = selectedId === null ? undefined : all.find((a) => a.id === selectedId);
  const tab: Tab = chosen ?? linked?.bucket ?? 'upcoming';
  const shown = tab === 'upcoming' ? upcoming : history;

  return (
    <>
      <h1 className="sr-only">Appointments</h1>
      <section className="flex min-h-[var(--page-h)] flex-col overflow-hidden rounded-xl border border-line bg-white">
        <div className="border-b border-line-soft px-6 py-4">
          <SegmentedTabs
            label="Appointments"
            options={[
              { value: 'upcoming', label: 'Upcoming', count: upcoming.length },
              { value: 'history', label: 'History', count: history.length },
            ]}
            value={tab}
            onChange={(value) => setChosen(value as Tab)}
            className="flex w-full [&>button]:flex-1 [&>button]:justify-center"
          />
        </div>
        <div className="flex flex-1 flex-col bg-surface-2 p-6">
          {shown.length === 0 ? (
            <div className="grid flex-1 place-items-center">
              <EmptyBlock icon="event_available" title={tab === 'upcoming' ? 'No upcoming appointments' : 'No past appointments'}>
                {tab === 'upcoming'
                  ? 'When the SDO sets an appointment for you, it shows up here and in your inbox.'
                  : 'Completed and cancelled appointments show up here.'}
              </EmptyBlock>
            </div>
          ) : (
            <div className="grid gap-4">
              {shown.map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} selected={appointment.id === selectedId} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
