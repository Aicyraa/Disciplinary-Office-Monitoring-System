import { useId, type ComponentProps } from 'react';
import { cn } from '@/utils/cn';
import { FieldShell, controlVariants, describedBy } from './FieldShell';

export type TextareaProps = ComponentProps<'textarea'> & {
  label: string;
  error?: string;
  hint?: string;
};

export function Textarea({ label, error, hint, id, className, ...rest }: TextareaProps) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, Boolean(hint), Boolean(error))}
        className={cn(controlVariants({ invalid: Boolean(error) }), 'min-h-24 py-2.5', className)}
        {...rest}
      />
    </FieldShell>
  );
}
