import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StaffStudentRow } from '@shared/types';
import { PageError } from '@/components/feedback/PageState';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { Avatar } from '@/components/ui/Avatar';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { controlVariants } from '@/components/ui/FieldShell';
import { Icon } from '@/components/ui/Icon';
import { ListCard } from '@/components/ui/ListCard';
import { Pager } from '@/components/ui/Pager';
import { casesApi } from '@/api/cases';
import { studentsApi } from '@/api/students';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/utils/cn';
import { matchesStudent } from '@/utils/studentRecord';

type Filter = 'all' | 'verify';

const ROW = cn(
  'flex w-full items-center gap-3 border-b border-line-soft px-4 py-3 text-left outline-none transition-colors',
  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
);

export function StudentList({ selectedId, onFirstRow }: { selectedId: string | null; onFirstRow: (id: string | null) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const list = useApi(() => studentsApi.students({ q: query.trim() || undefined, page }), [query, page]);
  // Sanctions waiting for verification, counted per student (the gold badge).
  const queue = useApi(() => casesApi.sanctionQueue({ filter: 'pending_verification' }), []);
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
          className="gap-1.5 [&>button]:min-h-11 [&>button]:flex-1 [&>button]:justify-center [&>button]:px-3 [&>button]:text-xs rail:[&>button]:min-h-[34px]"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.status === 'loading' ? (
          <SkeletonList label="Loading students…" />
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
              <Avatar firstName={row.firstName} lastName={row.lastName} url={row.avatarUrl} className="size-9 bg-info-soft text-[13px] text-primary" />
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
