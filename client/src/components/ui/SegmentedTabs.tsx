import { cn } from '@/utils/cn';
import { handleTabKeys, tabStopIndex, type TabOption } from './handleTabKeys';

/** Pill track with one raised option (Upcoming / History, Details / History). Keyboard as a tab list. */
export function SegmentedTabs({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly TabOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const stop = tabStopIndex(options, value);
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('inline-flex gap-0.5 rounded-full bg-line-soft p-[3px]', className)}
      onKeyDown={(event) => handleTabKeys(event, options, value, onChange)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={index === stop ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold whitespace-nowrap outline-none',
              'focus-visible:ring-[3px] focus-visible:ring-primary/35',
              selected ? 'bg-white text-ink shadow-tab' : 'text-muted hover:text-ink',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className="rounded-full bg-line-soft px-1.5 text-[11px] leading-5 font-bold text-muted">
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
