import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AccountRole, NotificationView } from '@shared/types';
import { api, toApiError } from '@/api/client';
import { useToast } from '@/components/feedback';
import { buttonVariants } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useUnread } from '@/context/UnreadContext';
import { bellFooter } from '@/utils/account';
import { cn } from '@/utils/cn';
import { notificationLook, notificationWhen } from '@/utils/inbox';

/** One row of the popover (deck src 343): icon circle, title (bold while unread), two lines of text, time, dot. */
export function BellRow({ item, onOpen }: { item: NotificationView; onOpen: () => void }) {
  const look = notificationLook(item.kind);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${item.isRead ? '' : 'Unread. '}${item.title}. ${item.message}`}
      className={cn(
        'flex w-full items-start gap-2.5 border-b border-line-soft px-3.5 py-2.5 text-left hover:bg-row-hover focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)] focus-visible:outline-none',
        item.isRead ? 'bg-white' : 'bg-tint-soft',
      )}
    >
      <span aria-hidden="true" className={cn('grid size-8 shrink-0 place-items-center rounded-full', look.tint)}>
        <Icon name={look.icon} className="!text-lg" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13px] leading-snug text-ink', item.isRead ? 'font-medium' : 'font-bold')}>{item.title}</span>
        <span className="line-clamp-2 text-[13px] leading-snug text-body">{item.message}</span>
        <span className="mt-0.5 block text-xs text-muted">{notificationWhen(item.dateCreated)}</span>
      </span>
      <span aria-hidden="true" className={cn('mt-1.5 size-2 shrink-0 rounded-full', item.isRead ? 'bg-transparent' : 'bg-primary')} />
    </button>
  );
}

/**
 * The bell and its popover (deck src 326 to 358). Both roles have it (D11). The latest five messages, "Mark all
 * as read" and "Open inbox"; on a phone the panel spans the width under the header.
 */
export function BellPopover({ role }: { role: AccountRole }) {
  const { unreadCount, setUnreadCount } = useUnread();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function load() {
    setError(null);
    api.notifications(role, { limit: 5 }).then(
      (data) => {
        setItems(data.notifications);
        setUnreadCount(data.unreadCount);
      },
      (caught: unknown) => setError(toApiError(caught).message),
    );
  }

  useEffect(() => {
    if (!open) return;
    load();
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
    // `load` only reads `role`, which is a dependency.
  }, [open, role]);

  async function openItem(item: NotificationView) {
    setOpen(false);
    if (!item.isRead) {
      try {
        const { unreadCount: count } = await api.markNotificationRead(role, item.id);
        setUnreadCount(count);
      } catch {
        // Opening still works; the dot simply stays until the next refresh.
      }
    }
    navigate(item.href ?? '/inbox');
  }

  async function markAll() {
    try {
      const { unreadCount: count } = await api.markAllNotificationsRead(role);
      setUnreadCount(count);
      setItems((current) => current?.map((item) => ({ ...item, isRead: true })) ?? null);
      toast.show('All notifications marked as read.', 'success');
    } catch (caught) {
      toast.show(toApiError(caught).message, 'error');
    }
  }

  const badge = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <div ref={rootRef} className="rail:relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-[42px] place-items-center rounded-full text-ink hover:bg-[rgba(127,137,160,0.18)] focus-visible:shadow-[0_0_0_3px_rgba(242,212,107,0.6)] focus-visible:outline-none"
      >
        <Icon name="notifications" className="!text-2xl" />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute top-[3px] right-0.5 grid h-[19px] min-w-[19px] place-items-center rounded-full border-2 border-white bg-gold px-[5px] text-[11px] font-extrabold text-ink"
          >
            {badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed top-[calc(60px+env(safe-area-inset-top))] right-2 left-2 z-[60] overflow-hidden rounded-xl border border-line bg-white text-body shadow-[0_16px_40px_rgba(16,22,52,0.18)] rail:absolute rail:top-12 rail:right-0 rail:left-auto rail:w-[380px] rail:max-w-[calc(100vw-16px)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line-soft px-6 py-4">
            <span className="text-[15px] font-bold text-ink">Notifications</span>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAll()}
                className="min-h-8 rounded-full px-2 text-[13px] font-semibold text-primary hover:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:outline-none"
              >
                Mark all as read
              </button>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="px-3.5 py-6 text-center text-[13px] text-danger">
              {error}
            </p>
          ) : items === null ? (
            <p role="status" className="px-3.5 py-6 text-center text-[13px] text-muted">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="px-3.5 py-6 text-center text-[13px] text-muted">No notifications yet.</p>
          ) : (
            items.map((item) => <BellRow key={item.id} item={item} onOpen={() => void openItem(item)} />)
          )}
          <div className="flex items-center justify-between gap-2 bg-surface-2 px-3.5 py-2.5">
            <span className="text-xs text-muted">{bellFooter(role)}</span>
            <Link to="/inbox" onClick={() => setOpen(false)} className={buttonVariants({ size: 'sm' })}>
              Open inbox
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
