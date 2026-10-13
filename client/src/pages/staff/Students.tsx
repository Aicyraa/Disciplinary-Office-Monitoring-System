import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { StaffStudentRecord, StaffStudentRow } from '@shared/types';
import { ConfirmModal } from '@/components/feedback';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { StatusPill } from '@/components/ui';
import { buttonVariants, Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { controlVariants } from '@/components/ui/FieldShell';
import { Icon } from '@/components/ui/Icon';
import { ListCard } from '@/components/ui/ListCard';
import { Pager } from '@/components/ui/Pager';
import { Tag } from '@/components/ui/Tag';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { ordinalYear } from '@/utils/account';
import { cn } from '@/utils/cn';
import { formatTerm } from '@/utils/format';
import { initials } from '@/utils/nav';
import {
  defaultRecordTab,
  isActiveCase,
  matchesStudent,
  recordCaseRow,
  recordSanctionRow,
  recordTiles,
  type RecordTab,
  type RecordTile,
} from '@/utils/studentRecord';

type Filter = 'all' | 'verify';

const ROW = cn(
  'flex w-full items-center gap-3 border-b border-line-soft px-4 py-3 text-left outline-none transition-colors',
  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
);

function StudentList({ selectedId, onFirstRow }: { selectedId: string | null; onFirstRow: (id: string | null) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const list = useApi(() => api.students({ q: query.trim() || undefined, page }), [query, page]);
  // Sanctions waiting for verification, counted per student (the gold badge).
  const queue = useApi(() => api.sanctionQueue({ filter: 'pending_verification' }), []);
  const toVerify = useMemo(() => {
    const counts = new Map<string, number>();
    if (queue.status === 'ready') {
      for (const row of queue.data.sanctions) if (row.student) counts.set(row.student.id, (counts.get(row.student.id) ?? 0) + 1);
    }
    return counts;
  }, [queue]);

  const rows: StaffStudentRow[] =
    list.status === 'ready' ? list.data.students.filter((row) => (filter === 'verify' ? toVerify.has(row.studentId) : matchesStudent(row, query))) : [];
  const firstId = list.status === 'ready' ? (rows[0]?.studentId ?? null) : undefined;
  useEffect(() => {
    if (firstId !== undefined) onFirstRow(firstId);
  }, [firstId, onFirstRow]);

  return (
    <ListCard className="flex h-full flex-col">
      <div className="flex flex-col gap-2.5 border-b border-line-soft p-4">
        <label className="relative block">
          <span className="sr-only">Search students</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 !text-xl text-muted-2" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setPage(1);
              setQuery(event.target.value);
            }}
            placeholder="Name or student ID"
            className={cn(controlVariants(), 'pl-10')}
          />
        </label>
        <ChipGroup
          label="Filter students"
          options={[
            { value: 'all', label: 'All students', count: list.status === 'ready' ? list.data.total : undefined },
            { value: 'verify', label: 'Sanctions to verify', count: queue.status === 'ready' ? toVerify.size : undefined },
          ]}
          value={filter}
          onChange={(value) => setFilter(value as Filter)}
          className="gap-1.5 [&>button]:min-h-11 [&>button]:px-3 [&>button]:text-xs rail:[&>button]:min-h-[34px]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.status === 'loading' ? (
          <p role="status" className="flex items-center justify-center gap-2 px-5 py-8 text-[13px] text-muted">
            <Spinner />
            Loading students…
          </p>
        ) : null}
        {list.status === 'error' ? <PageError page="the students" detail={list.error.message} onRetry={list.reload} /> : null}
        {list.status === 'ready' && rows.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-muted">No student matches.</p> : null}
        {rows.map((row) => {
          const selected = row.studentId === (selectedId ?? firstId);
          const waiting = toVerify.get(row.studentId) ?? 0;
          return (
            <Link
              key={row.studentId}
              to={`/students/${row.studentId}`}
              aria-current={selected ? 'true' : undefined}
              className={cn(ROW, selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover')}
            >
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-info-soft text-[13px] font-bold text-primary">
                {initials(row.firstName, row.lastName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {row.firstName} {row.lastName}
                </span>
                <span className="block truncate text-xs text-muted">
                  {row.studentId} · {row.program}
                </span>
              </span>
              {waiting > 0 ? (
                <span title="Sanctions to verify" className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-gold px-[7px] text-xs font-bold text-ink">
                  {waiting}
                  <span className="sr-only"> sanctions to verify</span>
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
      {list.status === 'ready' ? (
        <Pager
          page={page}
          pageCount={Math.max(1, Math.ceil(list.data.total / list.data.pageSize))}
          onChange={setPage}
          className="mt-auto border-t border-line-soft py-2.5"
        />
      ) : null}
    </ListCard>
  );
}

const ACCENT: Record<RecordTile['accent'], string> = {
  bad: 'bg-bad-ink',
  green: 'bg-success-strong',
  gold: 'bg-gold-line',
  primary: 'bg-primary',
};

/** One of the four tiles that act as tabs (src 952). The Clearance tile opens that student's clearance. */
function RecordTileButton({ tile, selected, onPick }: { tile: RecordTile; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        '@container relative flex min-h-[120px] min-w-0 flex-col items-start justify-center gap-1.5 rounded-xl border-[1.5px] bg-white py-4 pr-[18px] pl-[22px] text-left text-ink outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/30',
        selected ? 'border-primary' : 'border-line',
      )}
    >
      <span aria-hidden="true" className={cn('absolute top-3.5 -left-[1.5px] h-[34px] w-[5px] rounded-r-[3px]', ACCENT[tile.accent])} />
      <span className="text-[clamp(12px,7cqi,14px)] font-semibold text-muted">{tile.label}</span>
      <span className="text-[clamp(32px,22cqi,48px)] leading-none font-extrabold tracking-[-0.02em]">{tile.value}</span>
      <span className={cn('text-[clamp(11px,6cqi,12px)] font-medium', tile.warn ? 'text-bad-ink' : 'text-muted')}>{tile.sub}</span>
    </button>
  );
}

function ListBox({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-[10px] border border-line-soft">
      <div className="flex items-center justify-between gap-2 border-b border-line-soft bg-surface-2 px-4 py-2.5">
        <span className="text-sm font-bold text-ink">{title}</span>
        <span className="text-xs text-muted">{sub}</span>
      </div>
      {children}
    </div>
  );
}

function RecordLists({ data, tab }: { data: StaffStudentRecord; tab: RecordTab }) {
  if (tab === 'san') {
    return (
      <ListBox title="Sanctions" sub={`${data.sanctions.length} total`}>
        {data.sanctions.length === 0 ? <p className="px-4 py-5 text-center text-[13px] text-muted">No sanctions on record.</p> : null}
        {data.sanctions.map((sanction) => {
          const row = recordSanctionRow(sanction);
          return (
            <Link
              key={row.key}
              to={row.href}
              aria-label={`Open case ${row.caseCode}`}
              className="flex items-center gap-3.5 border-b border-line-soft px-4 py-3 outline-none hover:bg-tint-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              <span className="w-[104px] shrink-0 leading-snug">
                <span className="block text-xs font-bold text-ink">{row.code}</span>
                <span className="block text-xs whitespace-nowrap text-muted">{row.due}</span>
              </span>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block font-semibold text-pretty text-ink">{row.title}</span>
                <span className="block text-xs font-semibold text-primary">Case {row.caseCode}</span>
              </span>
              <StatusPill status={sanction.status} kind="sanction" />
            </Link>
          );
        })}
      </ListBox>
    );
  }
  const history = tab === 'history';
  const shown = data.cases.filter((item) => (history ? !isActiveCase(item) : isActiveCase(item)));
  return (
    <ListBox title={history ? 'Resolved cases' : 'Active cases'} sub={`${shown.length} case${shown.length === 1 ? '' : 's'}`}>
      {shown.length === 0 ? <p className="px-4 py-5 text-center text-[13px] text-muted">{history ? 'No resolved cases yet.' : 'No active cases.'}</p> : null}
      {shown.map((item) => {
        const row = recordCaseRow(item, data.sanctions);
        return (
          <Link
            key={row.key}
            to={row.href}
            className="flex min-h-16 items-center gap-3.5 border-b border-line-soft bg-white px-4 py-2.5 outline-none hover:bg-tint-soft focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
          >
            <span className="w-[104px] shrink-0 leading-snug">
              <span className="block text-xs font-bold whitespace-nowrap text-ink">{row.code}</span>
              <span className="block text-xs whitespace-nowrap text-muted">{row.date}</span>
            </span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="font-semibold text-ink">{item.violation}</span>
                <StatusPill status={item.severity} />
                {row.tag ? <Tag>{row.tag}</Tag> : null}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{row.line}</span>
            </span>
            <StatusPill status={item.status} kind="case" />
          </Link>
        );
      })}
    </ListBox>
  );
}

function StudentRecordPane({ studentId }: { studentId: string }) {
  const navigate = useNavigate();
  const record = useApi(() => api.student(studentId), [studentId]);
  // The Clearance tile reads this student's row of the current term (D3).
  const clearance = useApi(async () => {
    const { current } = await api.clearanceTerms();
    const roster = await api.clearanceRoster(current.academicYear, current.semester, { q: studentId });
    return { term: current, row: roster.students.find((row) => row.studentId === studentId) ?? null };
  }, [studentId]);
  const [tab, setTab] = useState<RecordTab | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);

  if (record.status === 'loading') {
    return (
      <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-line bg-white text-[13px] text-muted">
        <Spinner />
        Loading the record…
      </div>
    );
  }
  if (record.status === 'error') {
    return (
      <div className="rounded-xl border border-line bg-white">
        <PageError page="this student" detail={record.error.message} onRetry={record.reload} />
      </div>
    );
  }
  const data = record.data;
  const { profile } = data;
  const name = `${profile.firstName} ${profile.lastName}`;
  const current = tab ?? defaultRecordTab(data);
  const termInfo =
    clearance.status === 'ready' && clearance.data.row?.clearance
      ? { done: clearance.data.row.clearance.done, total: clearance.data.row.clearance.total, term: formatTerm(clearance.data.term.academicYear, clearance.data.term.semester) }
      : null;
  const tiles = recordTiles(data, termInfo);

  return (
    <section aria-label={`${name}, student record`} className="flex min-h-full flex-col gap-5 rounded-xl border border-line bg-white p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl leading-tight font-bold text-ink">{name}</h2>
          <p className="text-muted">
            {profile.studentId} · {profile.program} · {ordinalYear(profile.yearLevel)}
          </p>
          <p className="text-xs text-muted">{profile.email}</p>
          {!profile.isActive ? <p className="mt-1 text-xs font-semibold text-danger">Account is inactive</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="md" className="min-h-11 px-3.5 rail:min-h-[42px]" onClick={() => setConfirming(true)}>
            <Icon name="key" className="!text-xl" />
            Reset password
          </Button>
          <Link to={`/record?student=${profile.studentId}`} className={cn(buttonVariants({ variant: 'gold', size: 'md' }), 'min-h-11 px-3.5 rail:min-h-[42px]')}>
            <Icon name="add" className="!text-xl" />
            Record violation
          </Link>
        </div>
      </header>

      <div role="tablist" aria-label="Student record" className="@container grid grid-cols-2 gap-3 @min-[640px]:grid-cols-4">
        {tiles.map((tile) => (
          <RecordTileButton
            key={tile.key}
            tile={tile}
            selected={tile.key === current}
            onPick={() => {
              if (tile.key !== 'clr') {
                setTab(tile.key);
                return;
              }
              const term = clearance.status === 'ready' ? `${clearance.data.term.academicYear}-${clearance.data.term.semester}` : '';
              navigate(`/clearance/${profile.studentId}${term ? `?term=${term}` : ''}`);
            }}
          />
        ))}
      </div>

      <RecordLists data={data} tab={current} />

      <ConfirmModal
        open={confirming}
        title={`Reset password for ${name}?`}
        description="This creates a one-time temporary password. Their current password stops working, and they must choose a new one at next sign-in."
        confirmLabel="Create temporary password"
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
      <ConfirmModal
        open={temp !== null}
        tone="ok"
        title="Temporary password created"
        description={`Give this to ${name} in person. It works once and is not shown again.`}
        code={temp ?? undefined}
        confirmLabel="Done"
        hideCancel
        onClose={() => setTemp(null)}
        onConfirm={() => setTemp(null)}
      />
    </section>
  );
}

/** Staff Students (deck W30 to W32): searchable list, the student's record with tile tabs, reset password. */
export function StudentsPage() {
  const { id } = useParams();
  // With nothing selected, the wide layout shows the first student of the list (the deck always has one open).
  const [firstRow, setFirstRow] = useState<string | null>(null);
  return (
    <>
      <h1 className="sr-only">Students</h1>
      <MasterDetail
        ratio="students"
        detailKey={id}
        list={<StudentList selectedId={id ?? null} onFirstRow={setFirstRow} />}
        detail={id ? <StudentRecordPane key={id} studentId={id} /> : null}
        emptyDetail={
          firstRow === null ? (
            <div className="rounded-xl border border-line bg-white">
              <EmptyBlock icon="person_search" title="No student selected">
                Pick a student to see their cases, sanctions and clearance.
              </EmptyBlock>
            </div>
          ) : (
            <StudentRecordPane key={firstRow} studentId={firstRow} />
          )
        }
      />
    </>
  );
}
