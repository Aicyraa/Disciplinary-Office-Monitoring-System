import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

/** Same tones as `pillTone` in utils/format.ts (SPEC 9), expressed as the named tokens. */
const pillVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap', {
  variants: {
    tone: {
      pending: 'bg-pending-soft text-warn-ink',
      info: 'bg-info-soft text-info-ink',
      action: 'bg-amber-soft text-amber-ink',
      done: 'bg-success-soft text-success',
      bad: 'bg-bad-soft text-bad-ink',
      neutral: 'bg-neutral-soft text-neutral-ink',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type PillTone = NonNullable<VariantProps<typeof pillVariants>['tone']>;

export function Pill({ tone, className, children }: { tone?: PillTone; className?: string; children: ReactNode }) {
  return <span className={cn(pillVariants({ tone }), className)}>{children}</span>;
}
