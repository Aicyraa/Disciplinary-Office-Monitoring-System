import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { HandbookEntryView, SanctionTemplateView } from '@shared/types';
import { StatusPill } from '@/components/ui';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { Icon } from '@/components/ui/Icon';
import { ListCard } from '@/components/ui/ListCard';
import { cn } from '@/utils/cn';
import { filterTemplatesBy, sanctionCategories, templateFilters, templateState, type TemplateFilter } from '@/utils/templates';

const TILE = { done: 'bg-success-soft text-success', info: 'bg-info-soft text-info-ink', none: 'bg-page text-muted-2' } as const;

/** "All sanctions" (deck W47, src 1804 to 1820): filter chips, a state tile, the title, the state line, the category. */
export function TemplateList({
  templates,
  entries,
  selectedId,
}: {
  templates: SanctionTemplateView[];
  entries: HandbookEntryView[];
  selectedId: number | null;
}) {
  const [filter, setFilter] = useState<TemplateFilter>('all');
  const posted = templates.filter((t) => templateState(t).posted).length;
  const shown = filterTemplatesBy(templates, entries, filter);

  return (
    <ListCard className="flex h-full flex-col">
      <div className="border-b border-line-soft px-5 py-4">
        <h2 className="text-[17px] font-bold text-ink">All sanctions</h2>
        <p className="text-[13px] text-muted">
          {posted} of {templates.length} have a template or requirements
        </p>
      </div>
      <ChipGroup
        label="Filter sanctions"
        options={templateFilters(templates, entries)}
        value={filter}
        onChange={(value) => setFilter(value as TemplateFilter)}
        className="gap-1.5 border-b border-line-soft px-5 py-3 [&>button]:min-h-11 rail:[&>button]:min-h-10"
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.length === 0 ? <p className="px-5 py-8 text-center text-sm text-muted">No sanctions match this filter.</p> : null}
        {shown.map((template) => {
          const state = templateState(template);
          const selected = template.sanctionId === selectedId;
          return (
            <Link
              key={template.sanctionId}
              to={`/sanction-templates/${template.sanctionId}`}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'flex min-h-16 items-center gap-3 border-b border-line-soft px-5 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
                selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
              )}
            >
              <span aria-hidden="true" className={cn('grid size-9 shrink-0 place-items-center rounded-[10px]', TILE[state.tone])}>
                <Icon name={state.icon} className="!text-xl" />
              </span>
              <span className="min-w-0 flex-1 leading-snug">
                <span className="block truncate text-sm font-semibold text-ink">{template.type}</span>
                <span className="block truncate text-xs text-muted">{state.text}</span>
              </span>
              <span className="flex shrink-0 gap-1">
                {sanctionCategories(template.sanctionId, entries).map((category) => (
                  <StatusPill key={category} status={category} />
                ))}
              </span>
            </Link>
          );
        })}
      </div>
    </ListCard>
  );
}
