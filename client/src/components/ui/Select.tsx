import { useId, type ComponentProps } from 'react';
import { Icon } from '@/components/ui';
import { cn } from '@/utils/cn';
import { FieldShell, controlVariants, describedBy } from './FieldShell';

export type SelectProps = Omit<ComponentProps<'select'>, 'size'> & {
  label: string;
  error?: string;
  hint?: string;
  size?: 'md' | 'lg';
};

/** A native select (keyboard and screen readers for free) with the deck's chevron. */
export function Select({ label, error, hint, size = 'md', id, className, children, ...rest }: SelectProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint}>
      <div className="relative">
        <select
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(fieldId, Boolean(hint), Boolean(error))}
          className={cn(controlVariants({ invalid: Boolean(error), size }), 'appearance-none pr-10', className)}
          {...rest}
        >
          {children}
        </select>
        <Icon
          name="expand_more"
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-2"
        />
      </div>
    </FieldShell>
  );
}
