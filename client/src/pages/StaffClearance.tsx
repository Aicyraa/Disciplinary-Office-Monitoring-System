import { useState, type FormEvent } from 'react';
import type { StaffClearanceItemView, StaffClearanceView } from '@shared/types';
import { ReasonForm } from '../components/ReasonForm';
import { Card, EmptyState, Icon, PageHeader, Resource, StatusPill, buttonClass, fieldClass } from '../components/ui';
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

type ItemAction = { requirementId: number; kind: 'done' | 'reverse' } | null;

function ItemRow({
  clearance,
  item,
  action,
  setAction,
  onChanged,
  report,
}: {
  clearance: StaffClearanceView;
  item: StaffClearanceItemView;
  action: ItemAction;
  setAction: (action: ItemAction) => void;
  onChanged: () => void;
  report: (notice: { tone: 'success' | 'error'; text: string }) => void;
}) {
  const completed = item.status === 'completed';
  const open = action?.requirementId === item.requirementId ? action.kind : null;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <Icon name={completed ? 'check_circle' : 'radio_button_unchecked'} className={completed ? 'text-success' : 'text-muted'} />
          <div>
            <div className="font-medium text-ink">
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
            <div className="text-sm text-muted">
              {completed
                ? `Done ${item.dateCompleted ? formatDateTime(item.dateCompleted) : ''}${item.completedBy ? ` by ${item.completedBy}` : ''}`
                : 'Pending'}
              {item.remarks ? ` · ${item.remarks}` : ''}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {completed ? (
            <button
              type="button"
              className="rounded-md border border-line-strong bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-page"
              onClick={() => setAction({ requirementId: item.requirementId, kind: 'reverse' })}
            >
              Reverse
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-active"
              onClick={() => setAction({ requirementId: item.requirementId, kind: 'done' })}
            >
              Mark done
            </button>
          )}
          <button
            type="button"
            aria-label={`Remove ${item.label}`}
            className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-page"
            onClick={async () => {
              try {
                await api.removeRequirement(clearance.id, item.requirementId);
                report({ tone: 'success', text: `Removed "${item.label}".` });
              } catch (error) {
                report({ tone: 'error', text: toApiError(error).message });
              }
              onChanged();
            }}
          >
            Remove
          </button>
        </div>
      </div>

      {open === 'done' ? (
        <ReasonForm
          title={`Mark "${item.label}" done`}
          description="The student is notified."
          label="Remarks (optional)"
          submitLabel="Mark done"
          required={false}
          onCancel={() => setAction(null)}
          onSubmit={async (remarks) => {
            try {
              const { cleared } = await api.markRequirementDone(clearance.id, item.requirementId, remarks);
              setAction(null);
              report({ tone: 'success', text: cleared ? 'Marked done. The clearance is now cleared.' : 'Marked done.' });
              onChanged();
            } catch (error) {
              throw new Error(toApiError(error).message);
            }
          }}
        />
      ) : null}
      {open === 'reverse' ? (
        <ReasonForm
          title={`Reverse "${item.label}"`}
          description="The requirement goes back to pending and the student is told why."
          label="Reason (required)"
          submitLabel="Reverse"
          onCancel={() => setAction(null)}
          onSubmit={async (reason) => {
            try {
              await api.reverseRequirement(clearance.id, item.requirementId, reason);
              setAction(null);
              report({ tone: 'success', text: 'Reversed.' });
              onChanged();
            } catch (error) {
              throw new Error(toApiError(error).message);
            }
          }}
        />
      ) : null}
    </li>
  );
}

function AddItemForm({ clearanceId, onDone }: { clearanceId: number; onDone: (text: string) => void }) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = label.trim();
    if (text === '') {
      setError('Enter the requirement.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.addRequirement(clearanceId, text);
      setLabel('');
      onDone(`Added "${text}".`);
    } catch (caught) {
      setError(toApiError(caught).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 flex flex-wrap items-start gap-2 border-t border-line pt-3">
      <label htmlFor={`add-${clearanceId}`} className="sr-only">
        Custom requirement for this student
      </label>
      <input
        id={`add-${clearanceId}`}
        className={`${fieldClass} min-w-48 flex-1`}
        placeholder="Add a custom requirement for this student"
        maxLength={200}
        value={label}
        onChange={(event) => setLabel(event.target.value)}
      />
      <button type="submit" disabled={busy} className="rounded-md border border-line-strong bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-page">
        {busy ? 'Adding…' : 'Add'}
      </button>
      {error ? (
        <p role="alert" className="w-full text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function ClearanceCard({ clearance, onChanged }: { clearance: StaffClearanceView; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [action, setAction] = useState<ItemAction>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const hasWarning = clearance.items.some((item) => item.warning);

  return (
    <li className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-ink">
            {clearance.student.name} <span className="font-normal text-muted">({clearance.student.id})</span>
          </div>
          <div className="text-sm text-muted">
            {formatTerm(clearance.academicYear, clearance.semester)} · {progressLabel(clearance.items)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasWarning ? (
            <span className="rounded bg-[#FDECCB] px-1.5 py-0.5 text-xs font-semibold text-[#8A5A00]">Check open cases</span>
          ) : null}
          <StatusPill status={clearance.status} />
        </div>
      </div>

      <button
        type="button"
        className="mt-2 text-sm font-medium text-primary underline"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Hide checklist' : 'Open checklist'}
      </button>

      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mt-2 text-sm font-medium ${notice.tone === 'error' ? 'text-danger' : 'text-success'}`}
        >
          {notice.text}
        </p>
      ) : null}

      {open ? (
        <>
          <ul className="mt-2 divide-y divide-line">
            {clearance.items.map((item) => (
              <ItemRow
                key={item.requirementId}
                clearance={clearance}
                item={item}
                action={action}
                setAction={setAction}
                onChanged={onChanged}
                report={setNotice}
              />
            ))}
          </ul>
          <AddItemForm
            clearanceId={clearance.id}
            onDone={(text) => {
              setNotice({ tone: 'success', text });
              onChanged();
            }}
          />
          <button
            type="button"
            className="mt-3 text-sm font-medium text-primary underline"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((value) => !value)}
          >
            {showHistory ? 'Hide history' : 'History'}
          </button>
          {showHistory ? (
            <ol className="mt-2 space-y-1 text-sm" aria-label="Clearance history">
              {clearance.history.map((entry, index) => (
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
          ) : null}
        </>
      ) : null}
    </li>
  );
}

export function StaffClearancePage() {
  const [status, setStatus] = useState<'' | 'pending' | 'cleared'>('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const resource = useApi(
    () => api.staffClearances({ status: status || undefined, q, page }),
    [status, q, page],
  );

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQ(search.trim());
  }

  return (
    <>
      <PageHeader title="Clearance" subtitle="Mark each requirement by hand. Nothing is checked automatically." />
      <SetUpForm
        onCreated={(studentId) => {
          setSearch(studentId);
          setQ(studentId);
          setStatus('');
          setPage(1);
          resource.reload();
        }}
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form onSubmit={submitSearch} className="flex min-w-0 flex-1 gap-2" role="search">
          <label htmlFor="clearance-search" className="sr-only">
            Search clearances
          </label>
          <input
            id="clearance-search"
            type="search"
            placeholder="Search student name or ID"
            className={fieldClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" className={buttonClass}>
            Search
          </button>
        </form>
        <div>
          <label htmlFor="clearance-status" className="sr-only">
            Status
          </label>
          <select
            id="clearance-status"
            className={fieldClass}
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as '' | 'pending' | 'cleared');
            }}
          >
            <option value="">Pending and cleared</option>
            <option value="pending">Pending</option>
            <option value="cleared">Cleared</option>
          </select>
        </div>
      </div>

      <Resource resource={resource} onRetry={resource.reload}>
        {({ clearances, total, pageSize }) => {
          const pages = Math.max(1, Math.ceil(total / pageSize));
          if (clearances.length === 0) return <EmptyState title="No clearances match." hint="Set one up above." />;
          return (
            <>
              <ul className="space-y-3">
                {clearances.map((clearance) => (
                  <ClearanceCard key={clearance.id} clearance={clearance} onChanged={resource.reload} />
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
                  Page {page} of {pages} · {total} clearances
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
