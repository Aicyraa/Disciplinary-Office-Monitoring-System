import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { HandbookEntryView, Severity } from '@shared/types';
import { StatusPill } from '@/components/ui';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { controlVariants } from '@/components/ui/FieldShell';
import { Icon } from '@/components/ui/Icon';
import { ListCard } from '@/components/ui/ListCard';
import { cn } from '@/utils/cn';

type Category = 'all' | Severity;

const matches = (entry: HandbookEntryView, needle: string) => !needle || `${entry.violation} ${entry.section}`.toLowerCase().includes(needle);

/** "Handbook violations" (deck W44, src 1698 to 1716): search, category chips with counts, one row per violation. */
export function ViolationList({ entries, selectedId }: { entries: HandbookEntryView[]; selectedId: number | null }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const needle = query.trim().toLowerCase();
  const hits = useMemo(() => entries.filter((entry) => matches(entry, needle)), [entries, needle]);
  const shown = category === 'all' ? hits : hits.filter((entry) => entry.severity === category);
  const majors = entries.filter((entry) => entry.severity === 'Major').length;

  return (
    <ListCard className="flex h-full flex-col">
      <div className="border-b border-line-soft px-5 py-4">
        <h2 className="text-[17px] font-bold text-ink">Handbook violations</h2>
        <p className="text-[13px] text-muted">
          {entries.length} violation{entries.length === 1 ? '' : 's'} · {majors} major
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line-soft px-5 py-3">
        <label className="relative block min-w-0 flex-[1_1_200px]">
          <span className="sr-only">Search violations</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 !text-xl text-muted-2" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a violation or section…"
            className={cn(controlVariants(), 'pl-10')}
          />
        </label>
        <ChipGroup
          label="Category"
          options={(['all', 'Minor', 'Major'] as const).map((value) => ({
            value,
            label: value === 'all' ? 'All' : value,
            count: value === 'all' ? hits.length : hits.filter((entry) => entry.severity === value).length,
          }))}
          value={category}
          onChange={(value) => setCategory(value as Category)}
          className="gap-1.5 [&>button]:min-h-11 rail:[&>button]:min-h-10"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No violations match your search.</p> : null}
        {shown.map((entry) => {
          const selected = entry.id === selectedId;
          return (
            <Link
              key={entry.id}
              to={`/handbook/${entry.id}`}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'flex min-h-[60px] items-center gap-3 border-b border-line-soft px-5 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
              )}
            >
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block truncate text-sm font-semibold text-ink">{entry.violation}</span>
                <span className="block truncate text-xs text-muted">
                  Sec. {entry.section} · {entry.description}
                </span>
              </span>
              <StatusPill status={entry.severity} />
            </Link>
          );
        })}
      </div>
    </ListCard>
  );
}
