import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { NotificationView } from '@shared/types';
import { useToast } from '@/components/feedback';
import { MessageDialog } from '@/components/feedback/MessageDialog';
import { PageError, Spinner } from '@/components/feedback/PageState';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { Chip } from '@/components/ui/Chip';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { Icon } from '@/components/ui/Icon';
import { Pager } from '@/components/ui/Pager';
import { toApiError } from '@/api/client';
import { notificationsApi } from '@/api/notifications';
import { useAuth } from '@/context/AuthContext';
import { useUnread } from '@/context/UnreadContext';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/utils/cn';
import { filterInbox, inboxChips, inboxEmptyText, INBOX_PAGE_SIZE, notificationLook, notificationWhen, pageOf, type InboxCategory } from '@/utils/inbox';

/** One 80 px inbox row (deck src 1418 to 1426); the whole row opens the message. Rendered text is never markup. */
export function InboxRow({ item, onOpen }: { item: NotificationView; onOpen: () => void }) {
  const look = notificationLook(item.kind);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${item.isRead ? '' : 'Unread. '}${item.title}`}
      className={cn(
        'flex min-h-20 w-full items-center py-2 gap-3 overflow-hidden border-b border-line-soft px-6 text-left outline-none transition-colors hover:bg-row-hover focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)]',
        item.isRead ? 'bg-white' : 'bg-tint-soft',
      )}
    >
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', item.isRead ? 'bg-transparent' : 'bg-primary')} />
      <span aria-hidden="true" className={cn('grid size-9 shrink-0 place-items-center rounded-full', look.tint)}>
        <Icon name={look.icon} className="!text-xl" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-col items-start gap-0.5 rail:flex-row rail:items-center rail:gap-2">
          <span className={cn('line-clamp-2 text-sm break-words rail:truncate leading-snug text-ink', item.isRead ? 'font-medium' : 'font-bold')}>{item.title}</span>
          <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', look.tint)}>{look.category}</span>
        </span>
        <span className="mt-px block truncate text-[13px] leading-snug text-body">{item.message}</span>
        <span className="mt-0.5 block text-xs text-muted">{notificationWhen(item.dateCreated)}</span>
      </span>
      <Icon name="chevron_right" className="!text-xl text-disabled" />
    </button>
  );
}

/** Inbox for both roles (deck W58 to W61): chips, unread toggle, rows that open the message dialog. */
export function InboxPage() {
  const { state } = useAuth();
  const role = state.status === 'authenticated' ? state.user.role : 'student';
  const toast = useToast();
  const navigate = useNavigate();
  const { setUnreadCount } = useUnread();
  const resource = useApi(() => notificationsApi.notifications(role), [role]);
  const [category, setCategory] = useState<InboxCategory>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<NotificationView | null>(null);
  const [checking, setChecking] = useState(false);

  const all = useMemo(() => (resource.status === 'ready' ? resource.data.notifications : []), [resource]);
  const filtered = useMemo(() => filterInbox(all, category, unreadOnly), [all, category, unreadOnly]);
  const shown = pageOf(filtered, page, INBOX_PAGE_SIZE);
  const unread = resource.status === 'ready' ? resource.data.unreadCount : 0;

  async function openItem(item: NotificationView) {
    setOpen(item);
    if (item.isRead) return;
    try {
      const { unreadCount } = await notificationsApi.markNotificationRead(role, item.id);
      setUnreadCount(unreadCount);
      resource.reload();
    } catch {
      // Reading the message still works; the dot stays until the next refresh.
    }
  }

  async function markAll() {
    try {
      const { unreadCount } = await notificationsApi.markAllNotificationsRead(role);
      setUnreadCount(unreadCount);
      toast.show('All notifications marked as read.', 'success');
      resource.reload();
    } catch (error) {
      toast.show(toApiError(error).message, 'error');
    }
  }

  function refresh() {
    setChecking(true);
    resource.reload();
    setTimeout(() => {
      setChecking(false);
      toast.show('Up to date.', 'success');
    }, 600);
  }

  return (
    <>
      <h1 className="sr-only">Inbox</h1>
      <section className="flex min-h-[var(--page-h)] flex-col overflow-hidden rounded-xl border border-line bg-white">
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line-soft px-6 py-4">
          <ChipGroup
            label="Filter by category"
            options={inboxChips(all)}
            value={category}
            onChange={(value) => {
              setCategory(value as InboxCategory);
              setPage(1);
            }}
            className="min-w-0 flex-[1_1_auto] gap-1.5 [&>button]:min-h-11 rail:[&>button]:min-h-9"
          />
          <Chip
            selected={unreadOnly}
            onClick={() => {
              setUnreadOnly((value) => !value);
              setPage(1);
            }}
            className="min-h-11 px-3 rail:min-h-9"
          >
            <Icon name="mark_email_unread" className="!text-lg" />
            Unread only
          </Chip>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => void markAll()}
              className="min-h-11 rounded-full px-2.5 text-[13px] font-semibold text-primary outline-none hover:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25 rail:min-h-9"
            >
              Mark all as read
            </button>
          ) : null}
          <button
            type="button"
            onClick={refresh}
            disabled={checking}
            aria-busy={checking || undefined}
            aria-label={checking ? 'Checking for new notifications' : 'Check for new notifications'}
            title="Refresh"
            className="ml-auto grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-white text-body outline-none hover:border-primary hover:text-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 disabled:cursor-progress rail:size-9"
          >
            {checking ? <Spinner /> : <Icon name="refresh" className="!text-xl" />}
          </button>
        </div>

        <div className="min-h-0 flex-1">
          {resource.status === 'loading' ? (
            <SkeletonList label="Loading messages…" />
          ) : null}
          {resource.status === 'error' ? <PageError page="the inbox" detail={resource.error.message} onRetry={resource.reload} /> : null}
          {resource.status === 'ready' && shown.rows.length === 0 ? (
            <EmptyBlock icon="notifications_off" title={inboxEmptyText(category, unreadOnly)} className="py-12" />
          ) : null}
          {shown.rows.map((item) => (
            <InboxRow key={item.id} item={item} onOpen={() => void openItem(item)} />
          ))}
        </div>

        <p className="border-t border-line-soft px-4 py-2.5 text-xs text-muted">
          {role === 'staff' ? 'Showing messages for SDO staff. Notices you publish appear here too.' : 'Updates are also emailed to your school Outlook account.'}
        </p>
        <Pager page={shown.page} pageCount={shown.pages} onChange={setPage} className="mt-auto border-t border-line-soft py-2.5" />
      </section>

      <MessageDialog
        notification={open}
        onClose={() => setOpen(null)}
        onOpenRecord={(href) => {
          setOpen(null);
          navigate(href);
        }}
      />
    </>
  );
}
