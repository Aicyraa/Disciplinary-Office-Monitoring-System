/** Numbered dots joined by a line (deck: Reported, Validated, Sanctioned, Resolved / Assigned, In progress, ...). */
export function StageTracker({ steps, current, label }: { steps: readonly string[]; current: number; label: string }) {
  return (
    <ol aria-label={label} className="flex items-start">
      {steps.map((step, index) => {
        const done = index <= current;
        return (
          <li key={step} aria-current={index === current ? 'step' : undefined} className="relative flex flex-1 flex-col items-center text-center">
            {index > 0 ? (
              <span aria-hidden="true" className={`absolute top-3 right-1/2 h-0.5 w-full ${index <= current ? 'bg-primary' : 'bg-line'}`} />
            ) : null}
            <span
              className={`relative inline-flex size-6 items-center justify-center rounded-full border-2 text-xs font-bold ${
                done ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-muted'
              }`}
            >
              {index + 1}
            </span>
            <span className={`mt-1 text-xs ${index === current ? 'font-semibold text-ink' : 'text-muted'}`}>{step}</span>
          </li>
        );
      })}
    </ol>
  );
}
