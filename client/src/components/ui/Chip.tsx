import type { ComponentProps } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const chipVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold whitespace-nowrap',
    'min-h-[36px] transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35',
  ],
  {
    variants: {
      selected: {
        true: 'border-primary bg-primary text-white',
        false: 'border-line-strong bg-white text-ink hover:bg-page',
      },
    },
    defaultVariants: { selected: false },
  },
);

export type ChipProps = Omit<ComponentProps<'button'>, 'role'> & {
  selected: boolean;
  /** Optional count bubble. */
  count?: number;
  /** `tab` inside a ChipGroup (selected is `aria-selected`); a standalone chip is a toggle (`aria-pressed`). */
  role?: 'tab';
};

export function Chip({ selected, count, role, className, type = 'button', children, ...rest }: ChipProps) {
  return (
    <button
      type={type}
      role={role}
      aria-selected={role === 'tab' ? selected : undefined}
      aria-pressed={role === 'tab' ? undefined : selected}
      className={cn(chipVariants({ selected }), className)}
      {...rest}
    >
      {children}
      {count !== undefined ? (
        <span
          className={cn(
            'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-5 font-bold',
            selected ? 'bg-white/20 text-white' : 'bg-line-soft text-muted',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
