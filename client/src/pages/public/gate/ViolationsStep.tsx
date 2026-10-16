import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { violationTitle } from '@/utils/format';
import { categoryCounts, filterGateViolations, type GateCategory, type GateViolation } from '@/utils/gateForm';
import { violationsError } from '@/validators/gateForm';
import { CardHeader, CategoryPill, gateBackButton, gateCard, gateNavButton, gateNavRow } from './GateCard';
import { gateControl } from './GateFields';

/** Step 2 (deck W09 to W11): search, All / Minor / Major tabs and the checklist of violations. */
export function ViolationsStep({
  violations,
  selectedIds,
  search,
  category,
  pickError,
  onSearch,
  onCategory,
  onToggle,
  onPickError,
  onBack,
  onContinue,
}: {
  violations: GateViolation[];
  selectedIds: number[];
  search: string;
  category: GateCategory;
  pickError: string | null;
  onSearch: (value: string) => void;
  onCategory: (value: GateCategory) => void;
  onToggle: (id: number) => void;
  onPickError: (message: string | null) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const shown = filterGateViolations(violations, search, category);
  const counts = categoryCounts(violations, search);
  return (
    <div className={gateCard}>
      <CardHeader
        title="What were you stopped for?"
        subtitle="Check every violation the guard named. They’re sent together as one report."
        aside={
          <span aria-live="polite" className="shrink-0 rounded-full bg-info-soft px-3 py-1 text-xs font-bold whitespace-nowrap text-primary">
            {selectedIds.length ? `${selectedIds.length} selected` : 'None selected'}
          </span>
        }
      />
      <label className="relative block">
        <span className="sr-only">Search violations</span>
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted-2" />
        <input
          type="search"
          placeholder="Search violations"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className={cn(gateControl(false), 'pl-12')}
        />
      </label>
      <div role="tablist" aria-label="Classification" className="flex gap-1 rounded-[14px] bg-pale p-1">
        {(['All', 'Minor', 'Major'] as const).map((key) => {
          const on = category === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onCategory(key)}
              className={cn(
                'inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30',
                on ? 'bg-white text-primary shadow-tab' : 'text-muted hover:text-ink',
              )}
            >
              {key}
              <span className={cn('grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]', on ? 'bg-info-soft text-primary' : 'bg-line-soft text-muted')}>
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>
      {pickError ? <Alert tone="error">{pickError}</Alert> : null}
      <div role="group" aria-label="Violations" className="grid max-h-[340px] auto-rows-min gap-2 overflow-y-auto p-0.5 rail:max-h-[320px]">
        {shown.map((violation) => {
          const on = selectedIds.includes(violation.id);
          return (
            <button
              key={violation.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(violation.id)}
              className={cn(
                'flex min-h-[46px] w-full items-center gap-3 rounded-[14px] border-[1.5px] px-3 py-1.5 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30',
                on ? 'border-row-hover bg-row-hover' : 'border-line bg-white hover:border-upload-line',
              )}
            >
              <Icon name={on ? 'check_box' : 'check_box_outline_blank'} filled={on} className={cn('shrink-0 !text-2xl', on ? 'text-primary' : 'text-muted-2')} />
              <span className="min-w-0 flex-1 text-[15px] leading-snug font-semibold text-ink">{violationTitle(violation.name)}</span>
              <CategoryPill category={violation.category} />
            </button>
          );
        })}
        {shown.length === 0 ? <p className="p-4 text-center text-[13px] text-muted">No violation matches that search.</p> : null}
      </div>
      <div className={cn(gateNavRow, 'justify-between')}>
        <Button variant="neutral" size="xl" className={gateBackButton} onClick={onBack}>
          <Icon name="arrow_back" className="!text-xl" />
          Back
        </Button>
        <Button
          size="xl"
          className={gateNavButton}
          onClick={() => {
            const problem = violationsError(selectedIds);
            onPickError(problem);
            if (problem === null) onContinue();
          }}
        >
          Continue
          <Icon name="arrow_forward" className="!text-xl" />
        </Button>
      </div>
    </div>
  );
}
