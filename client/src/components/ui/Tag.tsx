import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Small amber label next to a case ("Escalated", "3rd minor · Major"). */
export function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-amber-soft px-2 py-px text-[11px] font-semibold whitespace-nowrap text-amber-ink',
        className,
      )}
    >
      {children}
    </span>
  );
}
