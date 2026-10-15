import { cn } from '@/utils/cn';

/** One grey placeholder block. Decorative: the wrapping state carries the announcement. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('rounded-md bg-skeleton motion-safe:animate-pulse', className)} />;
}

/**
 * Placeholder rows for a list or table while it loads. `label` is announced to screen readers
 * ("Loading cases…"); the visible part is only grey shapes.
 */
export function SkeletonList({ label, rows = 5, className }: { label: string; rows?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn('flex flex-col gap-3 px-4 py-4', className)}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} aria-hidden="true" className="flex items-center gap-3 rounded-xl border border-line bg-white p-3.5">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Placeholder for a detail pane or a single card: a title line and a few text lines. */
export function SkeletonPanel({ label, lines = 4, className }: { label: string; lines?: number; className?: string }) {
  return (
    <div role="status" aria-busy="true" className={cn('flex flex-col gap-3 rounded-xl border border-line bg-white p-5', className)}>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-1/3" />
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} className={cn('h-3.5', index === lines - 1 ? 'w-3/5' : 'w-full')} />
      ))}
    </div>
  );
}
