import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export type DetailRow = { label: string; value: ReactNode; /** Long value: label above, value full width. */ full?: boolean };

/** Bordered table of label / value rows (case, sanction and appointment details). */
export function DetailTable({ rows, className }: { rows: readonly DetailRow[]; className?: string }) {
  return (
    <dl className={cn('overflow-hidden rounded-[10px] border border-line-soft', className)}>
      {rows.map((row) => (
        <div
          key={row.label}
          className={cn(
            'border-b border-line-soft px-4 py-2.5 last:border-b-0',
            row.full ? 'block' : 'grid grid-cols-[104px_1fr] gap-3',
          )}
        >
          <dt className="text-xs font-semibold text-muted">{row.label}</dt>
          <dd className={cn('min-w-0 text-sm break-words text-ink', row.full && 'mt-1')}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
