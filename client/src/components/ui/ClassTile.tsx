import type { ComponentProps } from 'react';
import { cn } from '@/utils/cn';

const TONES = {
  all: { value: 'text-primary', bar: 'bg-primary' },
  minor: { value: 'text-info-ink', bar: 'bg-info-ink' },
  major: { value: 'text-bad-ink', bar: 'bg-bad-ink' },
} as const;

export type ClassTone = keyof typeof TONES;

/** Clickable filter tile (All / Minor / Major) with a class-coloured accent bar and number. */
export function ClassTile({
  label,
  value,
  tone,
  selected,
  className,
  type = 'button',
  ...rest
}: Omit<ComponentProps<'button'>, 'children'> & {
  label: string;
  value: number | string;
  tone: ClassTone;
  selected: boolean;
}) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'relative flex min-h-[88px] flex-col items-start gap-1 rounded-xl border-[1.5px] px-4 py-3 text-left outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-primary/35',
        selected ? 'border-primary bg-surface-2' : 'border-line bg-white hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true" className={cn('absolute top-3 left-0 h-5 w-[5px] rounded-r-full', TONES[tone].bar)} />
      <span className="text-[13px] font-semibold text-ink">{label}</span>
      <span className={cn('text-[32px] leading-9 font-extrabold', TONES[tone].value)}>{value}</span>
    </button>
  );
}
