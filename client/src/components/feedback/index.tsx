import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from 'react';
import { Icon, buttonClass, fieldClass } from '@/components/ui';

// ---- Toast ---------------------------------------------------------------------------------

export type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  show(message: string, tone?: ToastTone): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const TOAST_MS = 5_000;

/** Short confirmations after a save ("Saved.", "Temporary password created."). Errors stay until dismissed. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const show = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-2), { id, tone, message }]);
      if (tone !== 'error') setTimeout(() => dismiss(id), TOAST_MS);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 rail:bottom-6">
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-line-strong bg-white px-4 py-3 text-sm text-ink shadow-lg"
          >
            <Icon
              name={item.tone === 'error' ? 'error' : item.tone === 'info' ? 'info' : 'check_circle'}
              className={item.tone === 'error' ? 'text-danger' : item.tone === 'info' ? 'text-primary' : 'text-success'}
            />
            <span>{item.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(item.id)}
              className="-mr-2 inline-flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-ink"
            >
              <Icon name="close" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  // Outside a provider (a unit test of one page) a toast is simply dropped.
  return value ?? { show: () => undefined };
}

// ---- Confirm modal -------------------------------------------------------------------------

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** Red confirm button, for rejecting, returning, cancelling. */
  danger?: boolean;
  /** No Cancel button: a notice with one acknowledgement (for example the one-time temporary password). */
  hideCancel?: boolean;
  /** When set, the dialog has a text field; its trimmed value is passed to `onConfirm`. */
  reasonLabel?: string;
  /** The text field may stay empty (for example optional remarks). */
  reasonOptional?: boolean;
  /** Resolve to close the dialog; throw (or reject) to keep it open and show the message. */
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}

/** A modal confirm, optionally with a required reason (spec: the API checks the reason too). */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  hideCancel = false,
  reasonLabel,
  reasonOptional = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const titleId = useId();
  const fieldId = useId();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setReason('');
    setError(null);
    setBusy(false);
    const first = panelRef.current?.querySelector<HTMLElement>('textarea, button');
    first?.focus();
    return () => returnFocus.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('textarea, button:not([disabled])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const text = reason.trim();
    if (reasonLabel && !reasonOptional && text === '') {
      setError('Enter a reason.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-0 rail:items-center rail:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-t-xl bg-white p-5 shadow-xl rail:rounded-xl"
      >
        <form onSubmit={submit} noValidate>
          <h2 id={titleId} className="text-lg font-bold text-ink">
            {title}
          </h2>
          {description ? <div className="mt-1 text-sm text-body">{description}</div> : null}
          {reasonLabel ? (
            <div className="mt-4">
              <label htmlFor={fieldId} className="mb-1 block text-sm font-medium text-ink">
                {reasonLabel}
                {reasonOptional ? <span className="font-normal text-muted"> (optional)</span> : null}
              </label>
              <textarea
                id={fieldId}
                className={`${fieldClass} min-h-24`}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={error !== null}
              />
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="mt-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            {hideCancel ? null : (
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="min-h-11 rounded-md border border-line-strong bg-white px-4 text-sm font-semibold text-ink hover:bg-page disabled:opacity-60"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className={`${buttonClass} min-h-11 ${danger ? 'bg-danger hover:bg-danger/90' : ''}`}
            >
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---- Locked button -------------------------------------------------------------------------

interface LockedButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  /** When set the button is locked and this text says why (visible, and read by screen readers). */
  lockedReason?: string | null;
}

/** An action the user cannot take yet (for example "Download clearance slip" before every requirement is done). */
export function LockedButton({ lockedReason, children, className = '', ...rest }: LockedButtonProps) {
  const hintId = useId();
  const locked = Boolean(lockedReason);
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        {...rest}
        aria-disabled={locked || undefined}
        aria-describedby={locked ? hintId : undefined}
        onClick={locked ? (event) => event.preventDefault() : rest.onClick}
        className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-semibold ${
          locked ? 'cursor-not-allowed border border-line-strong bg-page text-muted' : `bg-primary text-white hover:bg-primary-active`
        } ${className}`}
      >
        {locked ? <Icon name="lock" className="text-base" /> : null}
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
