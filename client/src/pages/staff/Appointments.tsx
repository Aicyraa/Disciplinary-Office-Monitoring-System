import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { AppointmentStatus } from '@shared/types';
import { ConfirmModal, useToast } from '@/components/feedback';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { StatusPill } from '@/components/ui';
import { Button } from '@/components/ui/Button';
import { DetailTable } from '@/components/ui/DetailTable';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { controlVariants } from '@/components/ui/FieldShell';
import { GroupHead } from '@/components/ui/GroupHead';
import { HistoryList } from '@/components/ui/HistoryList';
import { Icon } from '@/components/ui/Icon';
import { ListCard } from '@/components/ui/ListCard';
import { Pager } from '@/components/ui/Pager';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import {
  appointmentHistory,
  appointmentToasts,
  groupHeadsFor,
  lastUpdated,
  RANGE_OPTIONS,
  statusOptions,
  studentMeta,
  whenText,
} from '@/utils/appointments';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';
import { dayRange } from '@/utils/staffDashboard';

export { EditAppointmentPage, MakeAppointmentPage } from './AppointmentForm';

/** Links inside the list carry this, so arriving from elsewhere (dashboard, bell) is told apart (5.4b). */
const FROM_LIST = { fromList: true } as const;

function FilterSelect({ label, aria, value, onChange, children }: { label: string; aria: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="w-11 shrink-0 text-xs font-semibold whitespace-nowrap text-muted">{label}</span>
      <span className="relative block min-w-0 flex-1">
        <select
          aria-label={aria}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(controlVariants(), 'min-h-11 cursor-pointer appearance-none pr-9 font-medium rail:min-h-10')}
        >
          {children}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted" />
      </span>
    </label>
  );
}

function AppointmentList({
  selectedId,
  reloadRef,
  onFirstRow,
}: {
  selectedId: number | null;
  reloadRef: React.MutableRefObject<(() => void) | null>;
  onFirstRow: (id: number | null) => void;
}) {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<AppointmentStatus | ''>('');
  const [range, setRange] = useState('');
  const [on, setOn] = useState('');
  // null: open the page that holds the selected appointment (a deep link); a number once the officer pages.
  const [page, setPage] = useState<number | null>(null);

  // Arriving from outside the list resets every filter that could hide the appointment (5.4b).
  const arrivedFromOutside = !(location.state as { fromList?: boolean } | null)?.fromList;
  useEffect(() => {
    if (!arrivedFromOutside) return;
    setSearch('');
    setQ('');
    setStatus('');
    setRange('');
    setOn('');
    setPage(null);
  }, [location.key, arrivedFromOutside]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ((current) => {
        if (current !== search.trim()) setPage(1);
        return search.trim();
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const resource = useApi(
    () =>
      api.staffAppointments({
        bucket: 'all',
        q,
        status,
        range,
        on,
        page: page ?? 1,
        focus: page === null && selectedId !== null ? selectedId : undefined,
      }),
    [q, status, range, on, page, page === null ? selectedId : null],
  );
  useEffect(() => {
    reloadRef.current = resource.reload;
  }, [reloadRef, resource.reload]);

  const firstId = resource.status === 'ready' ? (resource.data.appointments[0]?.id ?? null) : undefined;
  useEffect(() => {
    if (firstId !== undefined) onFirstRow(firstId);
  }, [firstId, onFirstRow]);

  const heads = resource.status === 'ready' ? groupHeadsFor(resource.data.appointments, resource.data.counts) : new Map();
  const highlighted = selectedId ?? (firstId === undefined ? null : firstId);
  const filterChanged = () => setPage(1);

  return (
    <ListCard className="flex h-full flex-col">
      <div className="flex flex-col gap-3 border-b border-line-soft px-6 py-[18px]">
        <label className="relative block">
          <span className="sr-only">Search appointments</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 !text-xl text-muted-2" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Student name, student ID or appointment ID"
            className={cn(controlVariants(), 'pl-10')}
          />
        </label>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-2.5">
          <FilterSelect
            label="Status"
            aria="Filter by status"
            value={status}
            onChange={(value) => {
              setStatus(value as AppointmentStatus | '');
              filterChanged();
            }}
          >
            {statusOptions(resource.status === 'ready' ? resource.data.statusCounts : null).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Dates"
            aria="Filter by date range"
            value={range}
            onChange={(value) => {
              setRange(value);
              filterChanged();
            }}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-11 shrink-0 text-xs font-semibold text-muted">On</span>
            <input
              type="date"
              aria-label="Filter by a specific date"
              value={on}
              onChange={(event) => {
                setOn(event.target.value);
                filterChanged();
              }}
              className={cn(controlVariants(), 'min-h-11 min-w-0 flex-1 cursor-pointer px-2.5 text-[13px] font-medium rail:min-h-9')}
            />
            {on ? (
              <button
                type="button"
                aria-label="Clear date filter"
                onClick={() => {
                  setOn('');
                  filterChanged();
                }}
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-primary-tint hover:text-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 rail:size-8"
              >
                <Icon name="close" className="!text-lg" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {resource.status === 'loading' ? (
          <p role="status" className="flex items-center justify-center gap-2 px-6 py-10 text-[13px] text-muted">
            <Spinner />
            Loading appointments…
          </p>
        ) : null}
        {resource.status === 'error' ? <PageError page="the appointments" detail={resource.error.message} onRetry={resource.reload} /> : null}
        {resource.status === 'ready' && resource.data.appointments.length === 0 ? (
          <EmptyBlock icon="event_busy" title="No appointments match">
            Try another status, date or search.
          </EmptyBlock>
        ) : null}
        {resource.status === 'ready'
          ? resource.data.appointments.map((row) => {
              const head = heads.get(row.id);
              const selected = row.id === highlighted;
              return (
                <div key={row.id}>
                  {head ? <GroupHead tone={head.tone} label={head.label} count={head.count} /> : null}
                  <Link
                    to={`/appointments/${row.id}`}
                    state={FROM_LIST}
                    aria-current={selected ? 'true' : undefined}
                    className={cn(
                      'flex min-h-[76px] items-center gap-3.5 border-b border-line-soft px-6 py-2.5 outline-none transition-colors',
                      'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                      selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
                    )}
                  >
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate text-[15px] font-bold text-ink">{row.student.name}</span>
                        <span className="shrink-0 text-[13px] font-medium text-muted">{row.student.id}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-body">
                        <Icon name="schedule" className="!text-base text-muted" />
                        {dayRange(row.startDate, row.endDate)}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted">
                        {row.code} · {row.purpose}
                      </span>
                    </span>
                    <span className="mt-0.5 shrink-0 self-start">
                      <StatusPill status={row.status} kind="appointment" />
                    </span>
                  </Link>
                </div>
              );
            })
          : null}
      </div>
      {resource.status === 'ready' ? (
        <Pager
          page={resource.data.page}
          pageCount={Math.max(1, Math.ceil(resource.data.total / resource.data.pageSize))}
          onChange={setPage}
          className="mt-auto border-t border-line-soft py-2.5"
        />
      ) : null}
    </ListCard>
  );
}

/** The right pane (deck W36, W37): window as the title, Details / History, the update footer. */
function AppointmentPane({ appointmentId, onChanged }: { appointmentId: number; onChanged: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
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
                <Button variant="secondary" size="xl" className="flex-[1_1_200px]" onClick={() => navigate(`/appointments/${a.id}/edit`)}>
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

/** Staff Appointments (deck W36, W37): filtered list on the left, the selected appointment on the right. */
export function StaffAppointmentsPage() {
  const { id } = useParams();
  const appointmentId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const reloadList = useRef<(() => void) | null>(null);
  const [firstRow, setFirstRow] = useState<number | null>(null);

  return (
    <>
      <h1 className="sr-only">Appointments</h1>
      <MasterDetail
        ratio="appointments"
        detailKey={appointmentId}
        list={<AppointmentList selectedId={appointmentId} reloadRef={reloadList} onFirstRow={setFirstRow} />}
        detail={appointmentId === null ? null : <AppointmentPane key={appointmentId} appointmentId={appointmentId} onChanged={() => reloadList.current?.()} />}
        emptyDetail={
          firstRow === null ? (
            <div className="grid min-h-full place-items-center rounded-xl border border-line bg-white">
              <EmptyBlock icon="calendar_month" title="No appointment selected">
                Pick one from the list.
              </EmptyBlock>
            </div>
          ) : (
            <AppointmentPane key={firstRow} appointmentId={firstRow} onChanged={() => reloadList.current?.()} />
          )
        }
      />
    </>
  );
}
