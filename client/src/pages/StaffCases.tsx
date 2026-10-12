import { useEffect, useRef, useState, type FormEvent, type MutableRefObject } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { CaseStatus, Severity, StaffCaseRow } from '@shared/types';
import { MasterDetail } from '../components/MasterDetail';
import { EmptyState, ErrorState, Icon, LoadingState, PageHeader, StatusPill, buttonClass, fieldClass } from '../components/ui';
import { api } from '../lib/api';
import { STATUS_ORDER, groupCases, statusOption } from '../lib/caseView';
import { formatDate } from '../lib/format';
import { useApi } from '../lib/useApi';
import { CaseWorkspace } from './StaffCaseDetail';

/** One line describing who a case is about: the matched student, or what the guard typed. */
export function whoLabel(row: Pick<StaffCaseRow, 'student' | 'claimed'>): string {
  if (row.student) return `${row.student.name} (${row.student.id})`;
  const claimed = row.claimed;
  if (claimed && (claimed.name || claimed.studentId)) {
    return `${claimed.name ?? 'Unknown'} (${claimed.studentId ?? 'no ID'}) · not matched`;
  }
  return 'Unknown student';
}

function ClassChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full border px-4 text-sm font-medium ${
        active ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function CaseQueue({ selectedId, reloadRef }: { selectedId: number | null; reloadRef: MutableRefObject<(() => void) | null> }) {
  // The queue opens on "Needs review" like the deck; "All statuses" is one choice away.
  const [status, setStatus] = useState<CaseStatus | ''>('reported');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [sort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  const resource = useApi(() => api.staffCases({ status, class: severity, q, sort, page }), [status, severity, q, sort, page]);
  useEffect(() => {
    reloadRef.current = resource.reload;
  }, [reloadRef, resource.reload]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQ(search.trim());
  }

  const counts = resource.status === 'ready' ? resource.data.statusCounts : null;

  return (
    <section aria-label="Case queue" className="rounded-lg border border-line bg-white">
      <div className="space-y-3 border-b border-line p-3">
        <form onSubmit={submitSearch} role="search" className="flex gap-2">
          <label className="relative block min-w-0 flex-1">
            <span className="sr-only">Search cases</span>
            <Icon name="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Case ID, student ID, name or violation"
              className={`${fieldClass} min-h-11 pl-10`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <button type="submit" className={`${buttonClass} min-h-11`}>
            Search
          </button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="case-status" className="text-sm font-medium text-muted">
            Status
          </label>
          <select
            id="case-status"
            className={`${fieldClass} min-h-11 w-auto min-w-0 flex-1`}
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as CaseStatus | '');
            }}
          >
            <option value="">
              All statuses{counts ? ` (${Object.values(counts).reduce((sum, n) => sum + n, 0)})` : ''}
            </option>
            {STATUS_ORDER.map((value) => (
              <option key={value} value={value}>
                {statusOption(value, counts?.[value])}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Class">
          {([['', 'All'], ['Minor', 'Minor'], ['Major', 'Major']] as const).map(([value, label]) => (
            <ClassChip
              key={label}
              active={severity === value}
              onClick={() => {
                setPage(1);
                setSeverity(value);
              }}
            >
              {label}
            </ClassChip>
          ))}
        </div>
      </div>

      {resource.status === 'loading' ? <LoadingState label="Loading cases…" cards={3} /> : null}
      {resource.status === 'error' ? <ErrorState message={resource.error.message} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' ? (
        resource.data.cases.length === 0 ? (
          <div className="p-3">
            <EmptyState title="No cases match." hint="Change the status or search." />
          </div>
        ) : (
          <>
            {groupCases(resource.data.cases).map((group) => (
              <div key={group.status}>
                <p className="flex items-center gap-2 bg-page px-3 py-1.5 text-[11px] font-bold tracking-wide text-muted uppercase">
                  {group.title}
                  <span className="font-normal normal-case">{group.rows.length === 1 ? "1 case" : `${group.rows.length} cases`}</span>
                </p>
                <ul>
                  {group.rows.map((row) => (
                    <li key={row.id}>
                      <Link
                        to={`/cases/${row.id}`}
                        aria-current={row.id === selectedId ? 'page' : undefined}
                        className={`flex min-h-16 gap-3 border-b border-line px-3 py-2 hover:bg-page ${
                          row.id === selectedId ? 'bg-primary/10' : ''
                        }`}
                      >
                        <span className="w-24 shrink-0 text-xs">
                          <span className="block font-semibold text-ink">{row.code}</span>
                          <span className="block text-muted">{formatDate(row.caseDate)}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {row.student?.name ?? row.claimed?.name ?? 'Unknown student'}
                            <span className="ml-1 font-normal text-muted">{row.student?.id ?? row.claimed?.studentId ?? ''}</span>
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted">
                            {row.violation}
                            <StatusPill status={row.severity} />
                            {row.isEscalated ? <span className="rounded-full bg-[#FCE9C6] px-2 py-0.5 text-xs font-semibold text-[#7A4600]">Escalated</span> : null}
                            {row.convertedFrom ? <span className="rounded-full bg-[#FCE9C6] px-2 py-0.5 text-xs font-semibold text-[#7A4600]">3rd minor · Major</span> : null}
                            {row.student === null ? <span className="rounded-full bg-[#FBE4E1] px-2 py-0.5 text-xs font-semibold text-danger">No matching record</span> : null}
                          </span>
                        </span>
                        <span className="shrink-0">
                          <StatusPill status={row.status} kind="case" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Pagination page={page} total={resource.data.total} pageSize={resource.data.pageSize} onPage={setPage} />
          </>
        )
      ) : null}
    </section>
  );
}

function Pagination({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  return (
    <nav className="flex items-center justify-between gap-2 border-t border-line p-3 text-sm" aria-label="Pagination">
      <button
        type="button"
        className="min-h-11 rounded-md border border-line-strong bg-white px-3 font-medium disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        Previous
      </button>
      <span className="text-muted">
        Page {page} of {pages} · {total} cases
      </span>
      <button
        type="button"
        className="min-h-11 rounded-md border border-line-strong bg-white px-3 font-medium disabled:opacity-50"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        Next
      </button>
    </nav>
  );
}

/** Staff Cases (deck W17 to W29): the queue on the left, the selected case on the right. */
export function CasesPage() {
  const { id } = useParams();
  const caseId = /^\d+$/.test(id ?? '') ? Number(id) : null;
  // The workspace tells the queue to reload after an action, so a validated report leaves "Needs review".
  const reloadQueue = useRef<(() => void) | null>(null);

  return (
    <>
      <PageHeader
        title="Cases"
        subtitle="Every recorded and reported violation."
        actions={
          <Link to="/record" className={`${buttonClass} min-h-11`}>
            Record violation
          </Link>
        }
      />
      <MasterDetail
        list={<CaseQueue selectedId={caseId} reloadRef={reloadQueue} />}
        detail={caseId === null ? null : <CaseWorkspace key={caseId} caseId={caseId} onChanged={() => reloadQueue.current?.()} />}
        emptyDetail={<EmptyState title="Select a case" hint="Open a report from the queue to validate it or follow its sanction." />}
        backTo="/cases"
        backLabel="All cases"
      />
    </>
  );
}
