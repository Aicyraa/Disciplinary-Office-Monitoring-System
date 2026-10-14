import seal from '@/assets/seal.png';
import { cn } from '@/utils/cn';

/**
 * The block that stays pinned at the top of the public form: the form's name and, on the three steps, the
 * progress indicator. It sits on the page colour with negative margins equal to the column's padding, so the
 * card scrolls cleanly underneath it, and it never changes size between steps.
 */
export function GatePinned({ steps, current }: { steps?: readonly string[]; current?: number }) {
  return (
    <div className="sticky top-0 z-10 -mx-3.5 -mt-4 bg-page px-3.5 pt-4 pb-3 rail:-mx-6 rail:-mt-10 rail:px-6 rail:pt-10 rail:pb-3.5">
      <div className="flex items-center justify-center gap-3">
        <img src={seal} alt="" className="size-12 shrink-0" />
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-extrabold text-ink rail:text-2xl">Violation Form</h1>
          <p className="text-sm font-semibold text-primary">Student Discipline Office</p>
        </div>
      </div>
      {steps && current !== undefined ? <GateSteps steps={steps} current={current} /> : null}
    </div>
  );
}

/** Three equal columns: a 36 px circle, a short connector to the previous one, and the label underneath. */
function GateSteps({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol aria-label="Progress" className="mx-auto mt-3.5 grid max-w-[440px] grid-cols-3">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="relative flex flex-col items-center">
            {index > 0 ? (
              <span
                aria-hidden="true"
                className={cn('absolute top-[16.5px] right-[calc(50%+22px)] h-[3px] w-[calc(100%-44px)] rounded-full', index <= current ? 'bg-primary' : 'bg-line')}
              />
            ) : null}
            <span
              className={cn(
                'relative grid size-9 place-items-center rounded-full text-[15px] font-bold',
                done || active ? 'bg-primary text-white' : 'bg-white text-muted shadow-[inset_0_0_0_2px_var(--color-line)]',
                active && 'shadow-step-current',
              )}
            >
              {done ? '✓' : index + 1}
            </span>
            <span className={cn('mt-1.5 text-[13px]', active ? 'font-bold text-ink' : 'font-medium text-muted')}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
