import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { toastDuration, type ToastTone } from '@/utils/feedback';

export type { ToastTone };

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  show(message: string, tone?: ToastTone): void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** One toast as the deck draws it (src 2086): a dark bar, gold check (or a red error icon), white text. */
export function ToastView({ tone, message, onDismiss }: { tone: ToastTone; message: string; onDismiss: () => void }) {
  const icon = tone === 'error' ? 'error' : tone === 'info' ? 'info' : 'check_circle';
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className="pointer-events-auto flex w-full items-center gap-2.5 rounded-[10px] bg-ink py-3 pr-2 pl-4 text-sm text-white shadow-[0_10px_30px_rgba(16,22,52,0.3)] rail:w-auto rail:max-w-[440px]"
    >
      <Icon name={icon} className={`!text-xl ${tone === 'error' ? 'text-toast-error' : 'text-gold'}`} />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-gold"
      >
        <Icon name="close" className="!text-lg" />
      </button>
    </div>
  );
}

/**
 * Short confirmations after an action ("SDO-2026-016 resolved."). One at a time, like the source: a new toast
 * replaces the old one. Bottom right on wide screens; full width above the tab bar on a phone.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [item, setItem] = useState<ToastItem | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback(() => setItem(null), []);
  const show = useCallback((message: string, tone: ToastTone = 'success') => {
    setItem({ id: nextId.current++, tone, message });
  }, []);

  useEffect(() => {
    if (!item) return;
    const ms = toastDuration(item.tone);
    if (ms === null) return;
    const timer = setTimeout(() => setItem((current) => (current?.id === item.id ? null : current)), ms);
    return () => clearTimeout(timer);
  }, [item]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[90] flex justify-center rail:inset-x-auto rail:right-5 rail:bottom-5 rail:justify-end print:hidden">
        {item ? <ToastView key={item.id} tone={item.tone} message={item.message} onDismiss={dismiss} /> : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  // Outside a provider (a unit test of one page) a toast is simply dropped.
  return value ?? { show: () => undefined };
}
