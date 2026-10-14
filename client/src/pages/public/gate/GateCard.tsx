import type { ReactNode } from 'react';
import { Pill } from '@/components/ui/Pill';
import { cn } from '@/utils/cn';

/** The card has no fixed height: it is as tall as the step needs. */
export const gateCard = 'flex flex-col gap-4 rounded-3xl bg-white px-[18px] py-5 shadow-gate-card rail:px-7 rail:py-[22px]';
export const gateNavRow = 'mt-1 flex items-center border-t border-line-soft pt-3.5';
export const gateNavButton = 'rounded-xl font-semibold';
export const gateBackButton = cn(gateNavButton, 'border-[1.5px] border-line text-primary hover:bg-pale');

export function CategoryPill({ category }: { category: 'Minor' | 'Major' }) {
  return <Pill tone={category === 'Major' ? 'bad' : 'info'}>{category}</Pill>;
}

export function CardHeader({ title, subtitle, aside }: { title: string; subtitle: string; aside?: ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[19px] font-bold text-ink">{title}</h2>
        {aside}
      </div>
      <p className="mt-0.5 text-[13px] text-pretty text-muted">{subtitle}</p>
    </div>
  );
}
