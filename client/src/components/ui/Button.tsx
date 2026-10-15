import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

/** UI-POLISH-SPEC 4.2: pill buttons, 34 / 42 / 44 / 48 / 50 px, 3 px focus ring, disabled and busy looks. */
export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-full border font-semibold whitespace-nowrap select-none',
    'transition-[color,background-color,border-color,box-shadow,transform,filter] duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35',
    'enabled:active:scale-[0.97] motion-reduce:transform-none',
    'disabled:border-transparent disabled:bg-disabled-bg disabled:text-disabled-ink',
  ],
  {
    variants: {
      variant: {
        primary:
          'border-transparent bg-primary text-white hover:bg-primary-hover active:bg-primary-press aria-busy:bg-primary-busy aria-busy:text-white',
        secondary: 'border-primary bg-white text-primary hover:bg-primary-tint',
        neutral: 'border-line-strong bg-white text-ink hover:bg-page',
        danger: 'border-danger-strong bg-white text-danger-strong hover:bg-danger-soft',
        dangerSolid: 'border-transparent bg-danger text-white hover:brightness-95 aria-busy:bg-danger aria-busy:text-white',
        success: 'border-transparent bg-success-strong text-white hover:brightness-95 aria-busy:bg-success-strong aria-busy:text-white',
        gold: 'border-gold-line bg-gold text-ink hover:bg-gold-hover',
        text: 'border-transparent bg-transparent text-primary hover:bg-info-soft',
      },
      size: {
        sm: 'min-h-[34px] px-3.5 text-[13px]',
        md: 'min-h-[42px] px-5 text-sm',
        lg: 'min-h-[44px] px-5 text-sm',
        xl: 'min-h-[48px] px-6 text-[15px]',
        xxl: 'min-h-[50px] px-6 text-[15px]',
      },
      fullWidth: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Swaps the label for a spinner and locks the button. */
    busy?: boolean;
    busyLabel?: string;
    /** Shown as the tooltip while the button is disabled ("Add a reason first"). */
    disabledReason?: string;
  };

export function Button({
  variant,
  size,
  fullWidth,
  busy = false,
  busyLabel = 'Saving…',
  disabledReason,
  disabled,
  className,
  type = 'button',
  title,
  children,
  ...rest
}: ButtonProps) {
  const locked = busy || Boolean(disabled);
  return (
    <button
      type={type}
      disabled={locked}
      aria-busy={busy || undefined}
      title={locked && !busy && disabledReason ? disabledReason : title}
      className={cn(buttonVariants({ variant, size, fullWidth }), className)}
      {...rest}
    >
      {busy ? (
        <>
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
          />
          {busyLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
