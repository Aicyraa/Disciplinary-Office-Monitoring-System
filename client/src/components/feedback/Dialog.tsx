import { useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { useDialogFocus } from './useDialogFocus';

/**
 * The deck's dialog frame (src 2018 to 2072): scrim, a centred white panel from 720 px and a bottom sheet on a
 * phone, focus kept inside, Escape and the backdrop close it. Content decides the rest.
 */
export function Dialog({
  open,
  labelledBy,
  onClose,
  maxWidth = 'max-w-[440px]',
  children,
}: {
  open: boolean;
  labelledBy: string;
  /** Undefined while the dialog must stay open (a save in progress). */
  onClose: (() => void) | undefined;
  maxWidth?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open, panelRef, onClose });
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[82] flex items-end justify-center bg-scrim rail:items-center rail:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'flex max-h-[92vh] w-full flex-col gap-3.5 overflow-y-auto rounded-t-[18px] bg-white p-[22px] pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[0_20px_50px_rgba(16,22,52,0.3)] rail:max-h-[calc(100vh-32px)] rail:rounded-[14px] rail:pb-6',
          maxWidth,
        )}
      >
        {children}
      </div>
    </div>
  );
}
