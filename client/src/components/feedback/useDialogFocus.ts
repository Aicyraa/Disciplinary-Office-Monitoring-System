import { useEffect, useRef, type RefObject } from 'react';

/** Never a tab stop: disabled controls and anything taken out of the tab order (the visually hidden file input of a picker). */
const SKIP = ':not([disabled]):not([tabindex="-1"])';
export const FOCUSABLE = ['a[href]', 'button', 'textarea', 'input:not([type="hidden"])', 'select', 'iframe', '[tabindex]'].map((tag) => `${tag}${SKIP}`).join(', ');
/** The first thing to focus: an element marked `data-autofocus`, else the first text field, else the first focusable control. */
export const INITIAL_FOCUS = ['[data-autofocus]', `textarea${SKIP}`, `input:not([type="hidden"]):not([type="file"])${SKIP}`].join(', ');

/**
 * Modal focus handling shared by every dialog: focus moves into the panel when it opens (the first field,
 * else the first button), Tab and Shift+Tab stay inside, Escape closes, and focus returns to the trigger.
 * Pass `onClose: undefined` while the dialog must not close (a save in progress).
 */
export function useDialogFocus({
  open,
  panelRef,
  onClose,
  fallbackFocus,
}: {
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onClose: (() => void) | undefined;
  /** Where focus goes on close when the element that opened the dialog is gone (a menu item whose menu closed). */
  fallbackFocus?: () => HTMLElement | null;
}): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const fallbackRef = useRef(fallbackFocus);
  fallbackRef.current = fallbackFocus;

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(INITIAL_FOCUS) ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const head = items[0];
      const tail = items[items.length - 1];
      if (event.shiftKey && document.activeElement === head) {
        event.preventDefault();
        tail.focus();
      } else if (!event.shiftKey && document.activeElement === tail) {
        event.preventDefault();
        head.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const target = returnTo?.isConnected && returnTo !== document.body ? returnTo : (fallbackRef.current?.() ?? null);
      target?.focus();
    };
  }, [open, panelRef]);
}
