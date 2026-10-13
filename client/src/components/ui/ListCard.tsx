import type { ComponentProps } from 'react';
import { cn } from '@/utils/cn';

/** Card that holds a list: radius 12, border, clipped corners so group heads and rows meet the edge. */
export function ListCard({ className, ...rest }: ComponentProps<'div'>) {
  return <div className={cn('overflow-hidden rounded-xl border border-line bg-white', className)} {...rest} />;
}
