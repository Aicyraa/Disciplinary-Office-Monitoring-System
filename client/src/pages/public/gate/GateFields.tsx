import { useId, type ComponentProps, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';

/** 44 px, 14 px radius, pale fill; white with a navy border and ring on focus. */
export const gateControl = (invalid: boolean) =>
  cn(
    'block h-11 w-full rounded-[14px] border-[1.5px] bg-pale px-4 text-[15px] text-ink outline-none placeholder:text-muted-2',
    'focus:bg-white focus:ring-4 focus:ring-primary/22',
    invalid ? 'border-danger focus:border-danger' : 'border-line hover:border-upload-line focus:border-primary',
  );

/**
 * Label above, control, and the error in a box that floats under the field's right edge, so a message never
 * changes the card's height. The 20 px gap between fields leaves room for it.
 */
function GateField({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-[5px] block text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      <p
        id={`${id}-error`}
        aria-live="polite"
        className={cn('absolute top-[calc(100%+3px)] right-0.5 flex max-w-[80%] flex-row-reverse items-center gap-1 text-[11px] font-semibold text-danger', !error && 'hidden')}
      >
        {error ? (
          <>
            <Icon name="error" className="!text-sm" />
            <span className="truncate">{error}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

type InputProps = Omit<ComponentProps<'input'>, 'id'> & { label: string; error?: string };

export function GateInput({ label, error, className, ...rest }: InputProps) {
  const id = useId();
  return (
    <GateField id={id} label={label} error={error}>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} className={cn(gateControl(Boolean(error)), className)} {...rest} />
    </GateField>
  );
}

type SelectProps = Omit<ComponentProps<'select'>, 'id'> & { label: string; error?: string };

export function GateSelect({ label, error, className, children, ...rest }: SelectProps) {
  const id = useId();
  return (
    <GateField id={id} label={label} error={error}>
      <span className="relative block">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(gateControl(Boolean(error)), 'cursor-pointer appearance-none pr-11', className)}
          {...rest}
        >
          {children}
        </select>
        <Icon name="expand_more" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-primary" />
      </span>
    </GateField>
  );
}
