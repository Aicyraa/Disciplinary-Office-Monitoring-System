import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import type { CaseStatus, Severity, StaffCaseRow } from '@shared/types';
import { EmptyState, PageHeader, Resource, StatusPill, buttonClass, fieldClass } from '../components/ui';
import { api } from '../lib/api';
import { formatDate, statusLabel } from '../lib/format';
import { useApi } from '../lib/useApi';

const STATUSES: CaseStatus[] = ['reported', 'validated', 'for_sanction', 'resolved', 'rejected'];

/** One line describing who a case is about: the matched student, or what the guard typed. */
export function whoLabel(row: Pick<StaffCaseRow, 'student' | 'claimed'>): string {
  if (row.student) return `${row.student.name} (${row.student.id})`;
  const claimed = row.claimed;
  if (claimed && (claimed.name || claimed.studentId)) {
    return `${claimed.name ?? 'Unknown'} (${claimed.studentId ?? 'no ID'}) · not matched`;
  }
  return 'Unknown student';
}

export function CasesPage() {
  const [status, setStatus] = useState<CaseStatus | ''>('');
  const [severity, setSeverity] = useState<Severity | ''>('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');

  const resource = useApi(
    () => api.staffCases({ status, class: severity, q, sort, page }),
    [status, severity, q, sort, page],
  );

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQ(search.trim());
  }

  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setPage(1);
    setter(value);
  };

  return (
    <>
      <PageHeader
        title="Cases"
        subtitle="Every recorded and reported violation."
        actions={
          <Link to="/record" className={buttonClass}>
            Record violation
          </Link>
        }
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <form onSubmit={submitSearch} className="flex min-w-0 flex-1 gap-2" role="search">
          <label htmlFor="case-search" className="sr-only">
            Search cases
          </label>
          <input
            id="case-search"
            type="search"
            placeholder="Search student, violation or case code (SDO-2026-005)"
            className={fieldClass}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="submit" className={buttonClass}>
            Search
          </button>
        </form>
        <div>
          <label htmlFor="case-status" className="sr-only">
            Status
          </label>
          <select
            id="case-status"
            className={fieldClass}
            value={status}
            onChange={(event) => reset(setStatus)(event.target.value as CaseStatus | '')}
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value, 'case')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="case-class" className="sr-only">
            Class
          </label>
          <select
            id="case-class"
            className={fieldClass}
            value={severity}
            onChange={(event) => reset(setSeverity)(event.target.value as Severity | '')}
          >
            <option value="">Minor and Major</option>
            <option value="Minor">Minor</option>
            <option value="Major">Major</option>
          </select>
        </div>
        <div>
          <label htmlFor="case-sort" className="sr-only">
            Sort
          </label>
          <select
            id="case-sort"
            className={fieldClass}
            value={sort}
            onChange={(event) => reset(setSort)(event.target.value as 'newest' | 'oldest')}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <Resource resource={resource} onRetry={resource.reload}>
        {({ cases, total, pageSize }) => {
          const pages = Math.max(1, Math.ceil(total / pageSize));
          if (cases.length === 0) return <EmptyState title="No cases match." />;
          return (
            <>
              <ul className="space-y-2">
                {cases.map((row) => (
                  <li key={row.id}>
                    <Link
                      to={`/cases/${row.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white p-3 hover:border-primary"
                    >
                      <div>
                        <div className="font-medium text-ink">
                          {row.code} · {row.violation}
                        </div>
                        <div className="text-sm text-muted">
                          {whoLabel(row)} · {formatDate(row.caseDate)} · {row.source === 'gate' ? 'Gate report' : 'Staff'}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <StatusPill status={row.severity} />
                        <StatusPill status={row.status} kind="case" />
                      </div>
                    </Link>
                  </li>
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
                  Page {page} of {pages} · {total} cases
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
