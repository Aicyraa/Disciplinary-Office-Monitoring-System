import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** The "HIGH" flag on case rows: 10 px, 800 weight, radius 4. */
export function HighTag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded bg-bad-soft px-1.5 py-px text-[10px] font-extrabold tracking-wide text-bad-ink',
        className,
      )}
    >
      {children}
    </span>
  );
}
