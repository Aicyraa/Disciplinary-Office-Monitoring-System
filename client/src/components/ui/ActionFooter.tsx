import type { ComponentProps } from 'react';
import { cn } from '@/utils/cn';

/** Full-bleed band at the bottom of a detail card that holds its actions. */
export function ActionFooter({ className, ...rest }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-end gap-3 border-t border-line-soft bg-surface-2 px-6 py-4', className)}
      {...rest}
    />
  );
}
