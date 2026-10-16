import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/utils/cn';
import { gateCard, gateNavRow } from './GateCard';

/**
 * What the form shows while its options and token load: the step-1 card in grey, at the same size and spacing
 * as `DetailsStep`, so nothing jumps when the real fields arrive. The status text is for screen readers only.
 */
export function GateSkeleton() {
  return (
    <div role="status" aria-busy="true" className={gateCard}>
      <span className="sr-only">Opening the form…</span>
      <div aria-hidden="true" className="flex flex-col gap-1.5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-3/5" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-5">
        {['w-24', 'w-20', 'w-16', 'w-[88px]'].map((width) => (
          <div key={width} className="flex flex-col gap-[5px]">
            <Skeleton className={cn('h-3.5', width)} />
            <Skeleton className="h-11 w-full rounded-[14px]" />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className={cn(gateNavRow, 'justify-end')}>
        <Skeleton className="h-12 w-36 rounded-xl" />
      </div>
    </div>
  );
}
