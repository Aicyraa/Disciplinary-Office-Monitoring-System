import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Textarea } from '@/components/ui/Textarea';
import { canConfirm, modalTone, type ModalTone } from '@/utils/feedback';
import { useDialogFocus } from './useDialogFocus';

export interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** Icon and confirm colour: blue (default), red for destructive or notifying actions, green to finish something. */
  tone?: ModalTone;
  /** Same as `tone="danger"`; kept for existing callers. */
  danger?: boolean;
  /** The dismiss button's words ("Keep reviewing", "Keep open", "Keep it"). Default "Cancel". */
  cancelLabel?: string;
  /** One acknowledgement button only (the temporary password notice). */
  hideCancel?: boolean;
  /** When set, the dialog has a text field; its trimmed value is passed to `onConfirm`. */
  reasonLabel?: string;
  reasonPlaceholder?: string;
  /** The text field may stay empty (optional remarks). */
  reasonOptional?: boolean;
  /** The text field's value when the dialog opens (the current remarks). */
  initialReason?: string;
  /** Shown in a dashed monospace box (a temporary password). */
  code?: string;
  /** The confirm label while `onConfirm` runs. */
  busyLabel?: string;
  /** Resolve to close the dialog; throw (or reject) to keep it open and show the message. */
  onConfirm: (reason: string) => Promise<void> | void;
  onClose: () => void;
}

/** The deck's modal (src 1977): tone icon, title, body, optional reason or code, then Cancel and the confirm. */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  tone,
  danger = false,
  cancelLabel = 'Cancel',
  hideCancel = false,
  reasonLabel,
  reasonPlaceholder,
  reasonOptional = false,
  initialReason = '',
  code,
  busyLabel = 'Working…',
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  const titleId = useId();
  const bodyId = useId();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const look = modalTone(tone ?? (danger ? 'danger' : 'primary'));
  const ready = canConfirm({ reasonRequired: Boolean(reasonLabel) && !reasonOptional, reason });

  useEffect(() => {
    if (!open) return;
    setReason(initialReason);
    setError(null);
    setBusy(false);
    // Reset only when the dialog opens; a changing initial value must not wipe what is being typed.
  }, [open]);

  useDialogFocus({ open, panelRef, onClose: busy ? undefined : onClose });

  if (!open) return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex animate-fade-in items-end justify-center bg-scrim rail:items-center rail:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? bodyId : undefined}
        className="max-h-[92vh] w-full max-w-[460px] animate-sheet-in rail:animate-pop-in overflow-y-auto rounded-t-[18px] bg-white p-6 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[0_20px_50px_rgba(16,22,52,0.3)] rail:max-h-[calc(100vh-32px)] rail:rounded-[14px] rail:pb-6"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${look.circle}`}>
              <Icon name={look.icon} />
            </span>
            <div className="min-w-0">
              <h2 id={titleId} className="text-xl font-bold text-ink">
                {title}
              </h2>
              {description ? (
                <div id={bodyId} className="mt-1.5 text-[15px] text-muted">
                  {description}
                </div>
              ) : null}
            </div>
          </div>

          {code ? (
            <p className="rounded-[10px] border border-dashed border-disabled bg-page px-3.5 py-3.5 text-center font-mono text-2xl font-bold tracking-[0.06em] text-ink select-all">
              {code}
            </p>
          ) : null}

          {reasonLabel ? (
            <Textarea
              label={reasonOptional ? `${reasonLabel} (optional)` : reasonLabel}
              placeholder={reasonPlaceholder}
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          ) : null}

          {error ? (
            <p role="alert" className="flex animate-shake items-center gap-2 rounded-lg border border-danger-line bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger-ink">
              <Icon name="error" className="!text-xl" />
              {error}
            </p>
          ) : null}

          <div className="mt-1 flex flex-wrap justify-end gap-2.5">
            {hideCancel ? null : (
              <Button variant="neutral" size="lg" onClick={onClose} disabled={busy}>
                {cancelLabel}
              </Button>
            )}
            <Button
              type="submit"
              variant={look.button}
              size="lg"
              busy={busy}
              busyLabel={busyLabel}
              disabled={!ready}
              disabledReason="Add a reason first"
            >
              {confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
