import { cn } from '@/utils/cn';

/** Small summary number (Reports to validate, Overdue ...). `danger` turns the value red. */
export function StatTile({
  label,
  value,
  tone = 'default',
  className,
}: {
  label: string;
  value: number | string;
  tone?: 'default' | 'danger';
  className?: string;
}) {
  return (
    <div className={cn('@container min-w-0 rounded-[10px] border border-line-soft bg-surface-2 px-3 py-2.5', className)}>
      <p className={cn('text-[clamp(22px,22cqi,32px)] leading-none font-extrabold tracking-[-0.02em]', tone === 'danger' ? 'text-bad-ink' : 'text-ink')}>
        {value}
      </p>
      <p className="mt-0.5 text-xs leading-snug font-medium text-pretty text-disabled-ink">{label}</p>
    </div>
  );
}
