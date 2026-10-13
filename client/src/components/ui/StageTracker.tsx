import { cn } from '@/utils/cn';

/** Circle size and line offset per size: cases 24 px, gate form 28 px, student pages 32 px (src 628, 137, 1159). */
const SIZES = {
  sm: { circle: 'size-6 text-xs', line: 'top-[11px] h-0.5', label: 'mt-1.5 text-xs' },
  md: { circle: 'size-7 text-xs', line: 'top-[13px] h-0.5', label: 'mt-1 text-xs' },
  lg: { circle: 'size-8 text-sm', line: 'top-[15px] h-[3px]', label: 'mt-2 text-[13px]' },
} as const;

/** Numbered dots joined by a line (deck: Reported, Validated, Sanctioned, Resolved / Assigned, In progress, ...). */
export function StageTracker({
  steps,
  current,
  label,
  size = 'sm',
}: {
  steps: readonly string[];
  current: number;
  label: string;
  size?: keyof typeof SIZES;
}) {
  const look = SIZES[size];
  return (
    <ol aria-label={label} className="flex items-start">
      {steps.map((step, index) => {
        const done = index <= current;
        return (
          <li key={step} aria-current={index === current ? 'step' : undefined} className="relative flex flex-1 flex-col items-center text-center">
            {index > 0 ? (
              <span aria-hidden="true" className={cn('absolute right-1/2 w-full', look.line, index <= current ? 'bg-primary' : 'bg-line')} />
            ) : null}
            <span
              className={cn(
                'relative inline-flex items-center justify-center rounded-full border-2 font-bold',
                look.circle,
                done ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-muted',
              )}
            >
              {index + 1}
            </span>
            <span className={cn(look.label, 'leading-tight', index === current ? 'font-bold text-ink' : 'font-medium text-muted')}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
