import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { Icon } from '@/components/ui';

/** Shared look of Field, Select and Textarea (UI-POLISH-SPEC 4.2): 44 px (48 on the gate form), radius 8. */
export const controlVariants = cva(
  [
    'block w-full rounded-lg border bg-white px-3 text-sm text-ink outline-none',
    'placeholder:text-muted-2 focus:ring-[3px] disabled:bg-disabled-bg disabled:text-disabled-ink',
  ],
  {
    variants: {
      invalid: {
        true: 'border-danger-strong focus:border-danger-strong focus:ring-danger-strong/20',
        false: 'border-line-strong focus:border-primary focus:ring-primary/18',
      },
      size: { md: 'min-h-11', lg: 'min-h-12' },
    },
    defaultVariants: { invalid: false, size: 'md' },
  },
);

/** The ids a control needs so its label, hint and error message are announced with it. */
export function describedBy(id: string, hasHint: boolean, hasError: boolean): string | undefined {
  const ids = [hasHint ? `${id}-hint` : '', hasError ? `${id}-error` : ''].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}

type ShellProps = { id: string; label: string; error?: string; hint?: string; children: ReactNode };

/** Label above, control, then the hint and the inline error with its icon. */
export function FieldShell({ id, label, error, hint, children }: ShellProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-strong">
          <Icon name="error" className="!text-[18px]" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
