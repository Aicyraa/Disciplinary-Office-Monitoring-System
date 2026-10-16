import { Link } from 'react-router-dom';
import type { HandbookEntryView } from '@shared/types';
import { StatusPill } from '@/components/ui';
import { controlVariants } from '@/components/ui/FieldShell';
import { Icon } from '@/components/ui/Icon';
import { ListCard } from '@/components/ui/ListCard';
import { Pager } from '@/components/ui/Pager';
import { cn } from '@/utils/cn';
import { violationTitle } from '@/utils/format';
import { HANDBOOK_PER_PAGE, firstSanctionText } from '@/utils/handbook';

const COLUMNS = 'rail:grid rail:grid-cols-[minmax(0,1.6fr)_84px_84px_minmax(0,1.2fr)] rail:gap-3';

/** The handbook table (deck src 1759 to 1801): search, Violation / Category / Section / Sanction, 6 per page. */
export function HandbookTable({
  rows,
  query,
  onQuery,
  page,
  onPage,
  selectedId,
}: {
  rows: HandbookEntryView[];
  query: string;
  onQuery: (value: string) => void;
  page: number;
  onPage: (page: number) => void;
  selectedId: number | null;
}) {
  const shown = rows.slice((page - 1) * HANDBOOK_PER_PAGE, page * HANDBOOK_PER_PAGE);
  return (
    <ListCard className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-line-soft p-4">
        <label className="relative block">
          <span className="sr-only">Search handbook</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 !text-xl text-muted-2" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search a violation, section or sanction…"
            className={cn(controlVariants(), 'pl-10')}
          />
        </label>
      </div>
      <div className={cn('hidden border-b border-line-soft bg-surface-2 px-6 py-3 text-[13px] font-semibold text-muted', COLUMNS)}>
        <span>Violation</span>
        <span>Category</span>
        <span>Section</span>
        <span>Sanction</span>
      </div>
      <div className="min-h-0 flex-1">
        {shown.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-muted">No handbook entry matches your search.</p> : null}
        {shown.map((entry) => {
          const selected = entry.id === selectedId;
          return (
            <Link
              key={entry.id}
              to={`/handbook/${entry.id}`}
              state={{ fromList: true }}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'flex min-h-[52px] items-center gap-2.5 border-b border-line-soft px-3 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rail:items-center rail:px-6',
                COLUMNS,
                selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{violationTitle(entry.violation)}</span>
                <span className="block truncate text-xs text-muted rail:hidden">
                  Sec. {entry.section} · {firstSanctionText(entry)}
                </span>
              </span>
              <span className="min-w-0 rail:order-none">
                <StatusPill status={entry.severity} />
              </span>
              <span className="hidden truncate text-xs text-muted rail:block">Sec. {entry.section}</span>
              <span className="hidden truncate text-xs text-body rail:block">{firstSanctionText(entry)}</span>
            </Link>
          );
        })}
      </div>
      <Pager page={page} pageCount={Math.max(1, Math.ceil(rows.length / HANDBOOK_PER_PAGE))} onChange={onPage} className="mt-auto border-t border-line-soft py-2.5" />
    </ListCard>
  );
}
