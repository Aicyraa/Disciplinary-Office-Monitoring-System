import { useId, useState } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';
import { Icon } from './Icon';

const hintVariants = cva('grid size-6 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30', {
  variants: {
    tone: {
      pending: 'bg-warn-soft text-warn-ink',
      info: 'bg-info-soft text-primary',
      bad: 'bg-bad-soft text-bad-ink',
      good: 'bg-success-soft text-success',
    },
  },
  defaultVariants: { tone: 'info' },
});

/**
 * A small status icon with a tooltip: shown on hover and keyboard focus, and toggled by a tap so it also works on
 * a phone. Screen readers get the same text as the button's name. Escape or leaving closes it.
 */
export function IconHint({ icon, label, tone, className }: { icon: string; label: string; className?: string } & VariantProps<typeof hintVariants>) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        className={cn(hintVariants({ tone }), className)}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <Icon name={icon} filled className="!text-base" />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-[calc(100%+6px)] left-1/2 z-20 w-max max-w-[220px] -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs leading-snug font-medium text-white shadow-lg"
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}
