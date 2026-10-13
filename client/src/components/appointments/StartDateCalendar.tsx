import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { calendarMonth, type CalendarCell } from '@/utils/appointments';
import { cn } from '@/utils/cn';

const CELL: Record<Exclude<CalendarCell['kind'], 'blank'>, string> = {
  start: 'border-primary bg-primary text-white',
  window: 'border-upload-line bg-info-soft text-info-ink',
  available: 'border-calendar-open bg-success-soft text-success hover:brightness-95',
  unavailable: 'cursor-not-allowed border-calendar-closed bg-page text-disabled',
};

const LEGEND: Array<[string, string]> = [
  ['Available', 'border-calendar-open bg-success-soft'],
  ['Start date', 'border-primary bg-primary'],
  ['Visit window', 'border-upload-line bg-info-soft'],
  ['Unavailable', 'border-calendar-closed bg-page'],
];

const longLabel = (date: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00Z`));

/**
 * The start-date month calendar of Make / Edit appointment (deck src 1556 to 1568): green days can start a
 * visit window, the start is primary and the next five working days are the window. The API re-checks.
 */
export function StartDateCalendar({ value, today, invalid, onChange }: { value: string; today: string; invalid: boolean; onChange: (date: string) => void }) {
  const anchor = value || today;
  const [month, setMonth] = useState({ year: Number(anchor.slice(0, 4)), month: Number(anchor.slice(5, 7)) - 1 });
  const view = calendarMonth(month.year, month.month, today, value);
  const shift = (by: number) => {
    const index = month.year * 12 + month.month + by;
    setMonth({ year: Math.floor(index / 12), month: index % 12 });
  };
  const nav = (enabled: boolean) =>
    cn(
      'grid size-11 place-items-center rounded-full text-white outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35 rail:size-9',
      enabled ? 'cursor-pointer bg-primary hover:bg-primary-hover' : 'cursor-not-allowed bg-line-strong',
    );

  return (
    <div className={cn('rounded-xl border bg-white p-4', invalid ? 'border-danger-strong' : 'border-line-strong')}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <button type="button" aria-label="Previous month" disabled={!view.canPrev} onClick={() => shift(-1)} className={nav(view.canPrev)}>
          <Icon name="chevron_left" className="!text-[22px]" />
        </button>
        <p aria-live="polite" className="text-lg font-bold text-ink">
          {view.title}
        </p>
        <button type="button" aria-label="Next month" disabled={!view.canNext} onClick={() => shift(1)} className={nav(view.canNext)}>
          <Icon name="chevron_right" className="!text-[22px]" />
        </button>
      </div>
      <div role="group" aria-label="Choose a start date" className="grid grid-cols-7 gap-1.5">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
          <div key={day} aria-hidden="true" className="pt-0.5 pb-1.5 text-center text-xs font-bold text-muted">
            {day}
          </div>
        ))}
        {view.cells.map((cell, index) =>
          cell.kind === 'blank' ? (
            <span key={`blank-${index}`} aria-hidden="true" />
          ) : (
            <button
              key={cell.date}
              type="button"
              disabled={cell.kind === 'unavailable'}
              aria-pressed={cell.kind === 'start'}
              aria-label={`${longLabel(cell.date)}${cell.kind === 'unavailable' ? ', unavailable' : ''}`}
              onClick={() => onChange(cell.date)}
              className={cn(
                'h-11 min-w-0 rounded-lg border-[1.5px] p-0 text-sm font-bold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-primary/35 rail:h-[38px]',
                CELL[cell.kind],
                cell.today && 'shadow-[inset_0_0_0_2px_var(--color-gold)]',
              )}
            >
              {cell.day}
            </button>
          ),
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-3.5 text-xs text-muted">
        {LEGEND.map(([label, swatch]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-3 rounded-[3px] border-[1.5px]', swatch)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
