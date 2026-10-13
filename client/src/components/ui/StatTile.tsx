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
    <div className={cn('rounded-[10px] border border-line-soft bg-surface-2 px-3.5 py-3', className)}>
      <p className={cn('text-[22px] leading-7 font-extrabold', tone === 'danger' ? 'text-danger' : 'text-ink')}>
        {value}
      </p>
      <p className="text-xs text-disabled-ink">{label}</p>
    </div>
  );
}
