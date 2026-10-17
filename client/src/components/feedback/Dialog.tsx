import { inBody } from './inBody';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';
import { useRegisterModal } from './modalOpen';
import { useDialogFocus } from './useDialogFocus';

/**
 * The deck's dialog frame (src 2018 to 2072): scrim, a centred white panel from 720 px and a bottom sheet on a
 * phone (18 px top radius, rendered at 90%), focus kept inside, Escape and the backdrop close it. Content decides
 * the rest. `bare` drops the padding and gap so a form modal can lay out its own header, scrolling body and footer.
 */
export function Dialog({
  open,
  labelledBy,
  onClose,
  maxWidth = 'max-w-[440px]',
  bare = false,
  fallbackFocus,
  children,
}: {
  open: boolean;
  labelledBy: string;
  /** Undefined while the dialog must stay open (a save in progress). */
  onClose: (() => void) | undefined;
  maxWidth?: string;
  bare?: boolean;
  /** Where focus returns on close if the element that opened the dialog no longer exists. */
  fallbackFocus?: () => HTMLElement | null;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open, panelRef, onClose, fallbackFocus });
  useRegisterModal(open);
  if (!open) return null;
  return inBody(
    <div
      className="fixed inset-0 z-[82] flex animate-fade-in items-end justify-center bg-scrim rail:items-center rail:p-4"
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
          'ui-zoom-phone flex animate-sheet-in rail:animate-pop-in max-h-[calc(92vh/var(--phone-zoom))] w-full flex-col rounded-t-[18px] bg-white shadow-[0_20px_50px_rgba(16,22,52,0.3)] rail:max-h-[calc(100vh-32px)] rail:rounded-[14px]',
          bare
            ? 'overflow-hidden'
            : 'gap-3.5 overflow-y-auto p-[22px] pb-[calc(20px+env(safe-area-inset-bottom))] rail:pb-6',
          maxWidth,
        )}
      >
        {children}
      </div>
    </div>,
  );
}
