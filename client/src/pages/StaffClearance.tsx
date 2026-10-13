import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StaffClearanceItemView, StaffClearanceView } from '@shared/types';
import { ProgressBar } from '../components/DashboardCards';
import { ConfirmModal, useToast } from '../components/feedback';
import { MasterDetail } from '../components/MasterDetail';
import { Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, StatusPill, buttonClass, fieldClass } from '../components/ui';
import { api, toApiError } from '../lib/api';
import { defaultSchoolYear, progressLabel } from '../lib/clearance';
import { manilaToday } from '../lib/files';
import { formatDateTime, formatTerm } from '../lib/format';
import { useApi } from '../lib/useApi';

const EVENT_LABEL: Record<StaffClearanceView['history'][number]['eventType'], string> = {
  set_up: 'Set up',
  marked_done: 'Marked done',
  reversed: 'Reversed',
  requirement_added: 'Requirement added',
  requirement_removed: 'Requirement removed',
};

function SetUpForm({ onCreated }: { onCreated: (studentId: string) => void }) {
  const [studentId, setStudentId] = useState('');
  const [year, setYear] = useState(String(defaultSchoolYear(manilaToday())));
  const [semester, setSemester] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const id = studentId.trim();
    if (!/^\d{4}-\d{7}$/.test(id)) {
      setError('Use the student ID format 2025-1234567.');
      return;
    }
    if (!/^\d{4}$/.test(year)) {
      setError('The school year is four digits, for example 2026.');
      return;
    }
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await api.setUpClearance({ studentId: id, academicYear: Number(year), semester: Number(semester) });
      setDone(`Standard requirements set up for ${id}, ${formatTerm(Number(year), Number(semester))}.`);
      setStudentId('');
      onCreated(id);
    } catch (caught) {
      setError(toApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4">
      <h2 className="text-lg font-semibold text-ink">Set up a clearance</h2>
      <p className="mt-1 text-sm text-muted">
        Creates the term&apos;s checklist with the four standard requirements. You can add or remove items afterwards.
      </p>
      <form onSubmit={submit} noValidate className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="clr-student" className="mb-1 block text-sm font-medium text-ink">
            Student ID
          </label>
          <input
            id="clr-student"
            className={`${fieldClass} w-44`}
            placeholder="2025-1234567"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="clr-year" className="mb-1 block text-sm font-medium text-ink">
            School year (start)
          </label>
          <input
            id="clr-year"
            inputMode="numeric"
            className={`${fieldClass} w-28`}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="clr-semester" className="mb-1 block text-sm font-medium text-ink">
            Semester
          </label>
          <select id="clr-semester" className={fieldClass} value={semester} onChange={(event) => setSemester(event.target.value)}>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </div>
        <button type="submit" disabled={busy} className={buttonClass}>
          {busy ? 'Setting up…' : 'Set up the 4 standard requirements'}
        </button>
      </form>
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="mt-2 text-sm font-medium text-success">
          {done}
        </p>
      ) : null}
    </Card>
  );
}

type RowAction = { requirementId: number; kind: 'done' | 'reverse' | 'remove' } | null;

function RequirementRow({
  clearance,
  item,
  onAction,
}: {
  clearance: StaffClearanceView;
  item: StaffClearanceItemView;
  onAction: (action: NonNullable<RowAction>) => void;
}) {
  const completed = item.status === 'completed';
  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 ${
        completed ? 'border-[#BFE3CB] bg-[#F1FAF4]' : 'border-line bg-white'
      }`}
    >
      <Icon name={completed ? 'check_circle' : 'radio_button_unchecked'} className={completed ? 'text-success' : 'text-muted'} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">
          {item.label}
          {item.warning ? (
            <span
              className="ml-2 rounded bg-[#FDECCB] px-1.5 py-0.5 text-xs font-semibold text-[#8A5A00]"
              title="The student still has validated or for-sanction cases"
            >
              Open cases: {clearance.openCases}
            </span>
          ) : null}
        </div>
        <div className={`text-xs ${completed ? 'text-success' : 'text-[#7A4600]'}`}>
          {completed
            ? `Completed${item.dateCompleted ? ` ${formatDateTime(item.dateCompleted)}` : ''}${item.completedBy ? ` by ${item.completedBy}` : ''}`
            : 'Remaining'}
          {item.remarks ? <span className="text-muted"> · {item.remarks}</span> : null}
        </div>
      </div>
      {completed ? (
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-white px-4 text-xs font-semibold text-ink hover:bg-page"
          onClick={() => onAction({ requirementId: item.requirementId, kind: 'reverse' })}
        >
          Reverse…
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-xs font-semibold text-white hover:bg-primary-active"
          onClick={() => onAction({ requirementId: item.requirementId, kind: 'done' })}
        >
          Record completion
        </button>
      )}
      <button
        type="button"
        aria-label={`Remove ${item.label}`}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted hover:bg-page hover:text-danger"
        onClick={() => onAction({ requirementId: item.requirementId, kind: 'remove' })}
      >
        <Icon name="delete" className="text-base" />
      </button>
    </li>
  );
}

function ClearanceRecord({ clearance, onChanged }: { clearance: StaffClearanceView; onChanged: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<'requirements' | 'history'>('requirements');
  const [action, setAction] = useState<RowAction>(null);
  const [adding, setAdding] = useState(false);
  const target = action ? clearance.items.find((item) => item.requirementId === action.requirementId) : undefined;
  const done = clearance.items.filter((item) => item.status === 'completed').length;
  const percent = clearance.items.length === 0 ? 0 : Math.round((done / clearance.items.length) * 100);

  const close = () => setAction(null);
  const refresh = (message: string) => {
    close();
    toast.show(message, 'success');
    onChanged();
  };

  return (
    <article aria-label={`Clearance, ${clearance.student.name}`} className="rounded-lg border border-line bg-white p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-ink">{clearance.student.name}</h2>
          <p className="text-sm text-muted">
            <Link to={`/students/${clearance.student.id}`} className="font-medium text-primary underline">
              {clearance.student.id}
            </Link>{' '}
            · {formatTerm(clearance.academicYear, clearance.semester)}
          </p>
        </div>
        <StatusPill status={clearance.status} kind="clearance" />
      </header>

      <div className="mt-4 flex rounded-full bg-page p-1" role="tablist" aria-label="Clearance sections">
        {(['requirements', 'history'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={tab === option}
            onClick={() => setTab(option)}
            className={`min-h-11 flex-1 rounded-full text-sm font-medium ${tab === option ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
          >
            {option === 'requirements' ? 'Requirements' : 'Activity history'}
          </button>
        ))}
      </div>

      {tab === 'requirements' ? (
        <>
          <p className="mt-4 flex items-center justify-between text-xs text-muted">
            <span>{progressLabel(clearance.items)}</span>
            <span>{percent}%</span>
          </p>
          <div className="mt-1">
            <ProgressBar percent={percent} label="Clearance progress" />
          </div>
          <ul className="mt-3 space-y-2">
            {clearance.items.map((item) => (
              <RequirementRow key={item.requirementId} clearance={clearance} item={item} onAction={setAction} />
            ))}
          </ul>
          <div className="mt-4 flex justify-end border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary px-4 text-sm font-semibold text-primary hover:bg-page"
            >
              <Icon name="add" className="text-base" />
              Add requirement
            </button>
          </div>
        </>
      ) : (
        <ol className="mt-4 space-y-3 border-l-2 border-line pl-4 text-sm" aria-label="Clearance history">
          {clearance.history.length === 0 ? <li className="text-muted">No activity yet.</li> : null}
          {[...clearance.history].reverse().map((entry, index) => (
            <li key={index}>
              <span className="font-medium text-ink">{EVENT_LABEL[entry.eventType]}</span>
              {entry.requirement ? <span> · {entry.requirement}</span> : null}{' '}
              <span className="text-muted">
                by {entry.by} · {formatDateTime(entry.date)}
              </span>
              {entry.remarks ? <div className="text-muted">{entry.remarks}</div> : null}
            </li>
          ))}
        </ol>
      )}

      <ConfirmModal
        open={action?.kind === 'done' && target !== undefined}
        title={`Record completion: ${target?.label ?? ''}`}
        description="The student is notified."
        reasonLabel="Remarks"
        reasonOptional
        confirmLabel="Record completion"
        onClose={close}
        onConfirm={async (remarks) => {
          try {
            const { cleared } = await api.markRequirementDone(clearance.id, target!.requirementId, remarks);
            refresh(cleared ? 'Recorded. The clearance is now cleared.' : 'Recorded.');
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
        }}
      />
      <ConfirmModal
        open={action?.kind === 'reverse' && target !== undefined}
        title={`Reverse: ${target?.label ?? ''}`}
        description="The requirement goes back to remaining and the student is told why."
        reasonLabel="Reason (required)"
        confirmLabel="Reverse"
        danger
        onClose={close}
        onConfirm={async (reason) => {
          try {
            await api.reverseRequirement(clearance.id, target!.requirementId, reason);
            refresh('Reversed.');
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
        }}
      />
      <ConfirmModal
        open={action?.kind === 'remove' && target !== undefined}
        title={`Remove "${target?.label ?? ''}"?`}
        description="Only this student's checklist changes. A clearance always keeps at least one requirement."
        confirmLabel="Remove"
        danger
        onClose={close}
        onConfirm={async () => {
          try {
            await api.removeRequirement(clearance.id, target!.requirementId);
            refresh(`Removed "${target!.label}".`);
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
        }}
      />
      <ConfirmModal
        open={adding}
        title="Add requirement"
        description="A custom requirement for this student and term."
        reasonLabel="Requirement"
        confirmLabel="Add requirement"
        onClose={() => setAdding(false)}
        onConfirm={async (label) => {
          try {
            await api.addRequirement(clearance.id, label);
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
          setAdding(false);
          toast.show(`Added "${label}".`, 'success');
          onChanged();
        }}
      />
    </article>
  );
}

function ClearanceQueue({ selectedId, reloadRef }: { selectedId: number | null; reloadRef: MutableRefObject<(() => void) | null> }) {
  const [status, setStatus] = useState<'' | 'pending' | 'cleared'>('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const resource = useApi(() => api.staffClearances({ status: status || undefined, q, page }), [status, q, page]);

  // The detail pane asks the list to refresh after a change.
  useEffect(() => {
    reloadRef.current = resource.reload;
  }, [reloadRef, resource.reload]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQ(search.trim());
  }

  return (
    <section aria-label="Clearances" className="rounded-lg border border-line bg-white">
      <div className="space-y-3 border-b border-line p-3">
        <h2 className="text-base font-bold text-ink">Students</h2>
        <form onSubmit={submitSearch} role="search" className="flex gap-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search clearances</span>
            <Icon name="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Student name or ID"
              className={`${fieldClass} min-h-11 pl-10`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="submit" className={`${buttonClass} min-h-11`}>
            Search
          </button>
        </form>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
          {(
            [
              ['', 'All'],
              ['pending', 'Not cleared'],
              ['cleared', 'Cleared'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={status === value}
              onClick={() => {
                setPage(1);
                setStatus(value);
              }}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
                status === value ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {resource.status === 'loading' ? <LoadingState label="Loading clearances…" cards={3} /> : null}
      {resource.status === 'error' ? <ErrorState message={resource.error.message} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' ? (
        resource.data.clearances.length === 0 ? (
          <div className="p-3">
            <EmptyState title="No clearances match." hint="Set one up with the button above." />
          </div>
        ) : (
          <>
            <ul>
              {resource.data.clearances.map((clearance) => {
                const done = clearance.items.filter((item) => item.status === 'completed').length;
                return (
                  <li key={clearance.id}>
                    <Link
                      to={`/clearance/${clearance.id}`}
                      aria-current={clearance.id === selectedId ? 'page' : undefined}
                      className={`flex min-h-14 items-center justify-between gap-3 border-b border-line px-3 py-2 hover:bg-page ${
                        clearance.id === selectedId ? 'bg-primary/10' : ''
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-ink">{clearance.student.name}</span>
                        <span className="block truncate text-xs text-muted">
                          {clearance.student.id} · {formatTerm(clearance.academicYear, clearance.semester)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-muted">
                        {clearance.status === 'cleared' ? 'Cleared' : `${done} / ${clearance.items.length}`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {Math.ceil(resource.data.total / resource.data.pageSize) > 1 ? (
              <nav className="flex items-center justify-between gap-2 border-t border-line p-3 text-sm" aria-label="Pagination">
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-line-strong bg-white px-3 font-medium disabled:opacity-50"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span className="text-muted">
                  Page {page} of {Math.ceil(resource.data.total / resource.data.pageSize)}
                </span>
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-line-strong bg-white px-3 font-medium disabled:opacity-50"
                  disabled={page >= Math.ceil(resource.data.total / resource.data.pageSize)}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </>
        )
      ) : null}
    </section>
  );
}

function SelectedClearance({ clearanceId, onChanged }: { clearanceId: number; onChanged: () => void }) {
  const resource = useApi(() => api.staffClearance(clearanceId), [clearanceId]);
  if (resource.status === 'loading') return <LoadingState label="Loading clearance…" cards={2} />;
  if (resource.status === 'error') return <ErrorState message={resource.error.message} onRetry={resource.reload} />;
  return (
    <ClearanceRecord
      clearance={resource.data.clearance}
      onChanged={() => {
        resource.reload();
        onChanged();
      }}
    />
  );
}

/** Staff Clearance (deck W50 to W56): students on the left, the selected student's requirements on the right. */
export function StaffClearancePage() {
  const { id } = useParams();
  const selectedId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  const reloadQueue = useRef<(() => void) | null>(null);
  const [setUp, setSetUp] = useState(false);

  return (
    <>
      <PageHeader
        title="Clearance"
        subtitle="Mark each requirement by hand. Nothing is checked automatically."
        actions={
          <button type="button" className={`${buttonClass} min-h-11`} onClick={() => setSetUp((value) => !value)} aria-expanded={setUp}>
            {setUp ? 'Close' : 'Set up a clearance'}
          </button>
        }
      />
      {setUp ? (
        <SetUpForm
          onCreated={() => {
            setSetUp(false);
            reloadQueue.current?.();
          }}
        />
      ) : null}
      <MasterDetail
        list={<ClearanceQueue selectedId={selectedId} reloadRef={reloadQueue} />}
        detail={selectedId === null ? null : <SelectedClearance key={selectedId} clearanceId={selectedId} onChanged={() => reloadQueue.current?.()} />}
        emptyDetail={<EmptyState title="Select a student" hint="Their requirements and activity history appear here." />}
        backTo="/clearance"
        backLabel="All students"
      />
    </>
  );
}
