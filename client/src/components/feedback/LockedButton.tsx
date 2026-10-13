import { useId, type ButtonHTMLAttributes } from 'react';
import { buttonVariants } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';

interface LockedButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /** When set the button is locked and this text says why (visible, and read by screen readers). */
  lockedReason?: string | null;
}

/**
 * An action the user cannot take yet, like "Download clearance slip" (deck W79): a grey pill with a lock and
 * the reason next to it. It stays focusable (aria-disabled) so the reason is still announced.
 */
export function LockedButton({ lockedReason, children, className, ...rest }: LockedButtonProps) {
  const hintId = useId();
  const locked = Boolean(lockedReason);
  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <button
        type="button"
        {...rest}
        aria-disabled={locked || undefined}
        aria-describedby={locked ? hintId : undefined}
        onClick={locked ? (event) => event.preventDefault() : rest.onClick}
        className={cn(
          buttonVariants({ variant: locked ? 'neutral' : 'primary', size: 'lg' }),
          locked && 'cursor-not-allowed border-line-soft bg-disabled-bg text-disabled-ink hover:bg-disabled-bg',
          className,
        )}
      >
        <Icon name={locked ? 'lock' : 'download'} className="!text-xl" />
        {children}
      </button>
      {locked ? (
        <span id={hintId} className="text-xs text-muted">
          {lockedReason}
        </span>
      ) : null}
    </span>
  );
}
