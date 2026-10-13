import { cn } from '@/utils/cn';
import { Chip } from './Chip';
import { handleTabKeys, tabStopIndex, type TabOption } from './handleTabKeys';

/** A row of filter chips that behaves as one tab list: one Tab stop, arrow keys move between chips. */
export function ChipGroup({
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
      className={cn('flex flex-wrap gap-2', className)}
      onKeyDown={(event) => handleTabKeys(event, options, value, onChange)}
    >
      {options.map((option, index) => (
        <Chip
          key={option.value}
          role="tab"
          selected={option.value === value}
          count={option.count}
          tabIndex={index === stop ? 0 : -1}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </div>
  );
}
