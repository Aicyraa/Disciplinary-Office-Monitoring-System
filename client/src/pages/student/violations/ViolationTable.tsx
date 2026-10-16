import { Link } from 'react-router-dom';
import type { StudentCaseView } from '@shared/types';
import { StatusPill } from '@/components/ui';
import { ListCard } from '@/components/ui/ListCard';
import { Pager } from '@/components/ui/Pager';
import { Tag } from '@/components/ui/Tag';
import { cn } from '@/utils/cn';
import { formatDate, violationTitle } from '@/utils/format';
import { caseTag } from '@/utils/studentView';

export const VIOLATIONS_PER_PAGE = 5;

/** The My violations table (deck src 1111 to 1143): heads from the rail width up, 52 px rows, 5 per page. */
export function ViolationTable({
  rows,
  page,
  onPage,
  selectedId,
  resolvedCount,
  showResolved,
  onToggleResolved,
}: {
  rows: StudentCaseView[];
  page: number;
  onPage: (page: number) => void;
  selectedId: number | null;
  resolvedCount: number;
  showResolved: boolean;
  onToggleResolved: () => void;
}) {
  const shown = rows.slice((page - 1) * VIOLATIONS_PER_PAGE, page * VIOLATIONS_PER_PAGE);
  return (
    <ListCard className="flex min-h-0 flex-1 flex-col">
      <div className="hidden grid-cols-[minmax(0,118px)_minmax(0,1fr)_120px] gap-3 border-b border-line-soft bg-surface-2 px-6 py-3 text-[13px] font-semibold text-muted rail:grid">
        <span>Case / Filed</span>
        <span>Violation</span>
        <span>Status</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? <p className="px-4 py-5 text-center text-[13px] text-muted">No violations match these filters.</p> : null}
        {shown.map((row) => {
          const tag = caseTag(row);
          const selected = row.id === selectedId;
          return (
            <Link
              key={row.id}
              to={`/violations/${row.id}`}
              state={{ fromList: true }}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'flex min-h-[52px] items-center gap-2.5 border-b border-line-soft px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rail:grid rail:grid-cols-[minmax(0,118px)_minmax(0,1fr)_120px] rail:gap-3 rail:px-6',
                selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
              )}
            >
              <span className="hidden min-w-0 leading-tight rail:block">
                <span className="block truncate text-xs font-bold text-ink">{row.code}</span>
                <span className="block truncate text-xs text-muted">{formatDate(row.caseDate)}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-semibold text-ink">{violationTitle(row.violation)}</span>
                  {tag ? <Tag className="shrink-0">{tag}</Tag> : null}
                </span>
                <span className="block truncate text-xs text-muted rail:hidden">
                  {row.code} · {formatDate(row.caseDate)}
                </span>
              </span>
              <span className="shrink-0">
                <StatusPill status={row.status} kind="case" />
              </span>
            </Link>
          );
        })}
      </div>
      <Pager page={page} pageCount={Math.max(1, Math.ceil(rows.length / VIOLATIONS_PER_PAGE))} onChange={onPage} className="mt-auto border-t border-line-soft py-2.5" />
      {resolvedCount > 0 || showResolved ? (
        <button
          type="button"
          onClick={onToggleResolved}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 border-t border-line-soft text-[13px] font-semibold text-primary outline-none hover:bg-primary-tint focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          {showResolved ? 'Show active cases' : `Show resolved cases (${resolvedCount})`}
        </button>
      ) : null}
    </ListCard>
  );
}
