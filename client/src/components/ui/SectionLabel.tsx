import { cn } from '@/utils/cn';

/** Form section heading: `1 · STUDENT`. */
export function SectionLabel({
  index,
  className,
  children,
}: {
  index?: number;
  className?: string;
  children: string;
}) {
  return (
    <p className={cn('text-xs font-bold tracking-[0.06em] text-muted uppercase', className)}>
      {index === undefined ? children : `${index} · ${children}`}
    </p>
  );
}
