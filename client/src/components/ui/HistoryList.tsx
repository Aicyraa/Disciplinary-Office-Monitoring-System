import { cn } from '@/utils/cn';

export type HistoryItem = { id: number | string; date: string; text: string; by?: string };

/** Date, sentence and actor, one row per event, in the order given (the caller sorts newest first). */
export function HistoryList({ items, className }: { items: readonly HistoryItem[]; className?: string }) {
  return (
    <ol className={cn('divide-y divide-line-soft', className)}>
      {items.map((item) => (
        <li key={item.id} className="grid grid-cols-[96px_1fr] gap-3 py-3">
          <span className="text-[13px] text-muted">{item.date}</span>
          <div className="min-w-0">
            <p className="text-sm text-ink">{item.text}</p>
            {item.by ? <p className="text-xs text-muted">{`by ${item.by}`}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
