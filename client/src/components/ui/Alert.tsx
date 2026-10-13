import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';

const alertVariants = cva('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13px] leading-5', {
  variants: {
    tone: {
      error: 'border-danger-line bg-danger-soft text-danger-ink',
      info: 'border-transparent bg-info-soft text-info-ink',
      warning: 'border-transparent bg-warn-soft text-warn-ink',
      success: 'border-success-line bg-success-soft text-success',
    },
  },
  defaultVariants: { tone: 'info' },
});

export type AlertTone = 'error' | 'info' | 'warning' | 'success';

const DEFAULT_ICON: Record<AlertTone, string> = {
  error: 'error',
  info: 'info',
  warning: 'warning',
  success: 'check_circle',
};

/** Tinted box with an icon. Errors and warnings interrupt (`alert`); info and success are polite (`status`). */
export function Alert({
  tone = 'info',
  icon,
  className,
  children,
}: {
  tone?: AlertTone;
  icon?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === 'error' || tone === 'warning' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
    >
      <Icon name={icon ?? DEFAULT_ICON[tone]} className="!text-[20px]" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
