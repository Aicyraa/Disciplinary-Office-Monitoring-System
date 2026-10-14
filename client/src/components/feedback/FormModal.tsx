import { useId, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Dialog } from './Dialog';

/**
 * The create / edit dialog every "add" action opens: header (icon chip, title, one-line subtitle, close), a body
 * that scrolls, and a sticky footer on the surface colour with the primary action on the right and Cancel next
 * to it. A centred dialog from 720 px, a bottom sheet on a phone. Esc and the backdrop close it unless `busy`.
 */
export function FormModal({
  open,
  icon,
  title,
  subtitle,
  busy = false,
  onClose,
  footer,
  maxWidth = 'max-w-[560px]',
  children,
}: {
  open: boolean;
  icon: string;
  title: string;
  subtitle: string;
  /** A save is running: the dialog cannot be dismissed. */
  busy?: boolean;
  onClose: () => void;
  footer: ReactNode;
  maxWidth?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <Dialog open={open} labelledBy={titleId} onClose={busy ? undefined : onClose} maxWidth={maxWidth} bare>
      <header className="flex shrink-0 items-start gap-3.5 border-b border-line-soft px-6 py-5">
        <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-info-soft text-primary">
          <Icon name={icon} className="!text-2xl" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg leading-tight font-bold text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-pretty text-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          disabled={busy}
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-line-soft focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:opacity-50"
        >
          <Icon name="close" className="!text-xl" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-line bg-surface-2 px-6 py-4 pb-[calc(16px+env(safe-area-inset-bottom))] rail:pb-4">
        {footer}
      </footer>
    </Dialog>
  );
}
