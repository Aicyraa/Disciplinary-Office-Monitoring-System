import type { ReactNode } from 'react';
import { Icon } from '@/components/ui';
import { cn } from '@/utils/cn';

/** Centred "nothing here" block inside a card or pane: icon, title, one line of help. */
export function EmptyBlock({
  icon = 'inbox',
  title,
  className,
  children,
}: {
  icon?: string;
  title: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-1 px-6 py-10 text-center', className)}>
      <Icon name={icon} className="!text-[32px] text-disabled" />
      <p className="font-semibold text-ink">{title}</p>
      {children ? <p className="text-[13px] text-muted">{children}</p> : null}
    </div>
  );
}
