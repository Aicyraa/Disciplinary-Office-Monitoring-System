import { useId, type ComponentProps } from 'react';
import { cn } from '@/utils/cn';
import { FieldShell, controlVariants, describedBy } from './FieldShell';

export type FieldProps = Omit<ComponentProps<'input'>, 'size'> & {
  label: string;
  error?: string;
  hint?: string;
  /** `lg` is the 48 px field of the public gate form. */
  size?: 'md' | 'lg';
};

export function Field({ label, error, hint, size = 'md', id, className, ...rest }: FieldProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, Boolean(hint), Boolean(error))}
        className={cn(controlVariants({ invalid: Boolean(error), size }), className)}
        {...rest}
      />
    </FieldShell>
  );
}
