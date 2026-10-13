import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { StaffStudentRow } from '@shared/types';
import { ConfirmModal, useToast } from '@/components/feedback';
import { Pagination } from '@/components/ui/Pagination';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { EmptyState, ErrorState, Icon, LoadingState, PageHeader, Resource, StatusPill, fieldClass } from '@/components/ui';
import { api, toApiError } from '@/api/client';
import { formatTerm } from '@/utils/format';
import { initials } from '@/utils/nav';
import { MINOR_THRESHOLD, matchesStudent, summarize } from '@/utils/studentRecord';
import { useApi } from '@/hooks/useApi';

type Filter = 'all' | 'verify';

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium ${
        active ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function StudentList({ selectedId }: { selectedId: string | null }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const list = useApi(() => api.students({ q: query.trim() || undefined, page }), [query, page]);
  // Students with a sanction waiting for verification: one staff queue call, grouped by student here.
  const queue = useApi(() => api.sanctionQueue({ filter: 'pending_verification' }), []);
  const toVerify = useMemo(
    () => new Set(queue.status === 'ready' ? queue.data.sanctions.flatMap((row) => (row.student ? [row.student.id] : [])) : []),
    [queue],
  );

  const rows: StaffStudentRow[] =
    list.status === 'ready'
      ? list.data.students.filter((row) => (filter === 'verify' ? toVerify.has(row.studentId) : matchesStudent(row, query)))
      : [];

  return (
    <section aria-label="Students" className="rounded-lg border border-line bg-white">
      <div className="space-y-3 border-b border-line p-3">
        <label className="relative block">
          <span className="sr-only">Search by name or student ID</span>
          <Icon name="search" className="absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="Name or student ID"
            className={`${fieldClass} min-h-11 pl-10`}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
            All students
            <span className="rounded-full bg-black/10 px-1.5 text-xs">{list.status === 'ready' ? list.data.total : '–'}</span>
          </Chip>
          <Chip active={filter === 'verify'} onClick={() => setFilter('verify')}>
            Sanctions to verify
            <span className="rounded-full bg-black/10 px-1.5 text-xs">{queue.status === 'ready' ? toVerify.size : '–'}</span>
          </Chip>
        </div>
      </div>
      {list.status === 'loading' ? <LoadingState label="Loading students…" cards={3} /> : null}
      {list.status === 'error' ? <ErrorState message={list.error.message} onRetry={list.reload} /> : null}
      {list.status === 'ready' && rows.length === 0 ? (
        <div className="p-3">
          <EmptyState title="No students match." hint="Try a different name or ID." />
        </div>
      ) : null}
      <ul>
        {rows.map((row) => (
          <li key={row.studentId}>
            <Link
              to={`/students/${row.studentId}`}
              aria-current={row.studentId === selectedId ? 'page' : undefined}
              className={`flex min-h-14 items-center gap-3 border-b border-line px-3 py-2 last:border-0 hover:bg-page ${
                row.studentId === selectedId ? 'bg-primary/10' : ''
              }`}
            >
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-page text-xs font-bold text-primary">
                {initials(row.firstName, row.lastName)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-ink">
                  {row.firstName} {row.lastName}
                </span>
                <span className="block truncate text-xs text-muted">
                  {row.studentId} · {row.program}
                </span>
              </span>
              {row.openCases > 0 ? (
                <span className="ml-auto rounded-full bg-page px-2 py-0.5 text-xs font-medium text-ink">{row.openCases} open</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {list.status === 'ready' ? (
        <Pagination page={page} total={list.data.total} pageSize={list.data.pageSize} onPage={setPage} noun="students" />
      ) : null}
    </section>
  );
}

function Tile({ label, value, hint, accent }: { label: string; value: string | number; hint: string; accent: string }) {
  return (
    <div className="relative rounded-lg border border-line bg-white p-3 pl-4">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 rounded-l-lg ${accent}`} />
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 font-bold text-ink ${typeof value === "number" ? "text-3xl" : "text-xl leading-9"}`}>{value}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

function ordinalYear(level: number): string {
  return `${level}${level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'} year`;
}

function StudentRecord({ studentId }: { studentId: string }) {
  const record = useApi(() => api.student(studentId), [studentId]);
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);

  return (
    <Resource resource={record} onRetry={record.reload}>
      {(data) => {
        const { profile } = data;
        const summary = summarize(data);
        const name = `${profile.firstName} ${profile.lastName}`;
        const active = data.cases.filter((item) => ['reported', 'validated', 'for_sanction'].includes(item.status));
        return (
          <section aria-label={`${name}, student record`} className="space-y-4">
            <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-white p-4">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-ink">{name}</h2>
                <p className="text-sm text-muted">
                  {profile.studentId} · {profile.program} · {ordinalYear(profile.yearLevel)}
                </p>
                <p className="text-xs text-muted">{profile.email}</p>
                {!profile.isActive ? <p className="mt-1 text-xs font-semibold text-danger">Account is inactive</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-line-strong bg-white px-3 text-sm font-semibold text-ink hover:bg-page"
                >
                  <Icon name="key" className="text-base" />
                  Reset password
                </button>
                <Link
                  to={`/record?student=${profile.studentId}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md bg-gold px-3 text-sm font-semibold text-ink hover:brightness-95"
                >
                  <Icon name="add" className="text-base" />
                  Record violation
                </Link>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-3">
              <Tile
                label="Active cases"
                value={summary.activeCases}
                hint={`Minor count ${summary.minorCount} of ${MINOR_THRESHOLD}`}
                accent="bg-danger"
              />
              <Tile label="Resolved cases" value={summary.resolvedCases} hint="Kept on file" accent="bg-success" />
              <Tile
                label="Sanctions"
                value={summary.sanctionsInProgress}
                hint={`${summary.sanctionsCleared} cleared`}
                accent="bg-gold"
              />
              <Tile
                label="Clearance"
                value={summary.clearance ? (summary.clearance.status === 'cleared' ? 'Cleared' : 'Not cleared') : '—'}
                hint={summary.clearance ? formatTerm(summary.clearance.academicYear, summary.clearance.semester) : 'Not set up'}
                accent="bg-primary"
              />
            </div>

            <section aria-label="Active cases" className="rounded-lg border border-line bg-white">
              <div className="flex items-center justify-between border-b border-line px-4 py-2">
                <h3 className="text-sm font-semibold text-ink">Active cases</h3>
                <span className="text-xs text-muted">{active.length === 1 ? "1 case" : `${active.length} cases`}</span>
              </div>
              {active.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted">No active cases.</p>
              ) : (
                <ul>
                  {active.map((item) => (
                    <li key={item.id} className="border-b border-line last:border-0">
                      <Link to={`/cases/${item.id}`} className="flex min-h-14 flex-wrap items-center justify-between gap-2 px-4 py-2 hover:bg-page">
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink">
                            {item.code} · {item.violation}
                          </span>
                          <span className="block text-xs text-muted">{item.severity}</span>
                        </span>
                        <StatusPill status={item.status} kind="case" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <ConfirmModal
              open={confirming}
              title="Reset password?"
              description={`${name}'s current password stops working immediately. A one-time temporary password is created for you to hand over in person.`}
              confirmLabel="Reset password"
              danger
              onClose={() => setConfirming(false)}
              onConfirm={async () => {
                try {
                  const result = await api.resetStudentPassword(profile.studentId);
                  setConfirming(false);
                  setTemp(result.tempPassword);
                } catch (error) {
                  throw new Error(toApiError(error).message);
                }
              }}
            />

            {temp !== null ? (
              <ConfirmModal
                open
                title="Temporary password created"
                description={
                  <>
                    <p>
                      Give this to {name} in person. It works once and is not shown again.
                    </p>
                    <p className="mt-3 rounded-md border border-dashed border-line-strong bg-page px-3 py-3 text-center font-mono text-lg font-semibold tracking-wider text-ink select-all">
                      {temp}
                    </p>
                  </>
                }
                confirmLabel="Done"
                hideCancel
                onClose={() => {
                  setTemp(null);
                  toast.show('Password reset. The student must set a new one at next sign-in.', 'info');
                }}
                onConfirm={() => {
                  setTemp(null);
                }}
              />
            ) : null}
          </section>
        );
      }}
    </Resource>
  );
}

/** Staff Students page (deck W30 to W32): searchable list, the student's record, reset password. */
export function StudentsPage() {
  const { id } = useParams();
  return (
    <>
      <PageHeader title="Students" subtitle="Look up a student, review their record or reset their password." />
      <MasterDetail
        list={<StudentList selectedId={id ?? null} />}
        detail={id ? <StudentRecord key={id} studentId={id} /> : null}
        emptyDetail={<EmptyState title="Select a student" hint="Their cases, sanctions and clearance appear here." />}
        backTo="/students"
        backLabel="All students"
      />
    </>
  );
}
