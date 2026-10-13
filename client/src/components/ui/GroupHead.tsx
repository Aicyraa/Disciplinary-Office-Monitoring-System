import { cn } from '@/utils/cn';

const DOTS = {
  bad: 'bg-bad-ink',
  warn: 'bg-warn-ink',
  gold: 'bg-gold-line',
  done: 'bg-success',
  info: 'bg-info-ink',
  neutral: 'bg-muted-2',
} as const;

export type GroupTone = keyof typeof DOTS;

/** Header of a group of rows: coloured dot, uppercase label and a count ("6 cases" when `unit` is given). */
export function GroupHead({
  tone,
  label,
  count,
  unit,
  className,
}: {
  tone: GroupTone;
  label: string;
  count: number;
  unit?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 border-b border-line-soft bg-surface-2 px-6 py-2.5', className)}>
      <span aria-hidden="true" className={cn('size-2 rounded-full', DOTS[tone])} />
      <span className="text-xs font-bold tracking-[0.04em] text-ink uppercase">{label}</span>
      <span className="text-xs text-muted">{unit ? `${count} ${unit}` : count}</span>
    </div>
  );
}
