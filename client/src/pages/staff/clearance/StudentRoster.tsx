import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TermRef } from '@shared/types';
import { PageError } from '@/components/feedback/PageState';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { ListCard } from '@/components/ui/ListCard';
import { Pager } from '@/components/ui/Pager';
import { clearanceApi } from '@/api/clearance';
import { useApi } from '@/hooks/useApi';
import { ordinalYear } from '@/utils/account';
import { rosterProgress, termParam } from '@/utils/clearance';
import { cn } from '@/utils/cn';

const PROGRESS_TONE = { ink: 'text-ink', done: 'text-success', muted: 'text-disabled-ink' } as const;

export function StudentRoster({
  term,
  selectedId,
  onFirstRow,
  reloadRef,
}: {
  term: TermRef;
  selectedId: string | null;
  onFirstRow: (id: string | null) => void;
  reloadRef: React.MutableRefObject<(() => void) | null>;
}) {
  const [page, setPage] = useState(1);
  const roster = useApi(() => clearanceApi.clearanceRoster(term.academicYear, term.semester, { page }), [term.academicYear, term.semester, page]);
  useEffect(() => {
    reloadRef.current = roster.reload;
  }, [reloadRef, roster.reload]);
  useEffect(() => setPage(1), [term.academicYear, term.semester]);
  const firstId = roster.status === 'ready' ? (roster.data.students[0]?.studentId ?? null) : undefined;
  useEffect(() => {
    if (firstId !== undefined) onFirstRow(firstId);
  }, [firstId, onFirstRow]);
  const highlighted = selectedId ?? firstId ?? null;

  return (
    <ListCard className="flex h-full flex-col">
      <div className="sticky top-0 z-[1] border-b border-line-soft bg-white px-6 py-4">
        <h2 className="text-[19px] font-bold text-ink">Students</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {roster.status === 'loading' ? (
          <SkeletonList label="Loading students…" />
        ) : null}
        {roster.status === 'error' ? <PageError page="the students" detail={roster.error.message} onRetry={roster.reload} /> : null}
        {roster.status === 'ready' && roster.data.students.length === 0 ? (
          <p className="px-6 py-8 text-center text-[13px] text-muted">No active students for this term.</p>
        ) : null}
        {roster.status === 'ready'
          ? roster.data.students.map((row) => {
              const progress = rosterProgress(row.clearance);
              const selected = row.studentId === highlighted;
              return (
                <Link
                  key={row.studentId}
                  to={`/clearance/${row.studentId}?term=${termParam(term)}`}
                  aria-current={selected ? 'true' : undefined}
                  className={cn(
                    'flex items-center gap-3 border-b border-line-soft px-6 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                    selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{row.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {row.studentId} · {row.program} {ordinalYear(row.yearLevel)}
                    </span>
                  </span>
                  <span className={cn('text-[13px] font-bold whitespace-nowrap', PROGRESS_TONE[progress.tone])}>{progress.text}</span>
                </Link>
              );
            })
          : null}
      </div>
      {roster.status === 'ready' ? (
        <Pager
          page={roster.data.page}
          pageCount={Math.max(1, Math.ceil(roster.data.total / roster.data.pageSize))}
          onChange={setPage}
          className="mt-auto border-t border-line-soft py-2.5"
        />
      ) : null}
    </ListCard>
  );
}
