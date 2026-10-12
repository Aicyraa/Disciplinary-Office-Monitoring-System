import { useNavigate } from 'react-router-dom';
import type { NotificationKind, NotificationView } from '@shared/types';
import { useAuth } from '../auth/AuthContext';
import { ConfirmModal } from '../components/feedback';
import { EmptyState, ErrorState, Icon, LoadingState, PageHeader, buttonClass } from '../components/ui';
import { api, toApiError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { INBOX_CATEGORY_LABEL, categoryCounts, filterInbox, pageOf, type InboxCategory } from '../lib/inbox';
import { useApi } from '../lib/useApi';
import { useUnread } from '../notifications/UnreadContext';
import { useMemo, useState } from 'react';

const KIND_ICON: Record<NotificationKind, string> = {
  report: 'report',
  case: 'folder_open',
  esc: 'priority_high',
  sanction: 'assignment',
  appt: 'event',
  clr: 'verified_user',
  account: 'manage_accounts',
  newviol: 'gavel',
  notice: 'campaign',
};

/** Presentational list, so it can be rendered and tested without the network. */
export function NotificationList({
  notifications,
  onOpen,
  onMarkRead,
  onView,
}: {
  notifications: NotificationView[];
  onOpen: (notification: NotificationView) => void;
  onMarkRead: (notification: NotificationView) => void;
  /** Open the message dialog. Optional: the list also renders without it. */
  onView?: (notification: NotificationView) => void;
}) {
  return (
    <ul className="space-y-2">
      {notifications.map((notification) => (
        <li
          key={notification.id}
          className={`rounded-lg border p-3 ${notification.isRead ? 'border-line bg-white' : 'border-primary/40 bg-[#F5F6FC]'}`}
        >
          <div className="flex items-start gap-3">
            <Icon name={KIND_ICON[notification.kind]} className={notification.isRead ? 'text-muted' : 'text-primary'} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-sm text-ink ${notification.isRead ? 'font-medium' : 'font-bold'}`}>{notification.title}</span>
                {notification.isRead ? null : (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">New</span>
                )}
              </div>
              <p className="mt-0.5 text-sm break-words">{notification.message}</p>
              <p className="mt-1 text-xs text-muted">{formatDateTime(notification.dateCreated)}</p>
            </div>
            {onView ? (
              <button
                type="button"
                onClick={() => onView(notification)}
                aria-label={`Read: ${notification.title}`}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-muted hover:bg-page"
              >
                <Icon name="open_in_full" className="text-base" />
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {notification.href ? (
              <button
                type="button"
                onClick={() => onOpen(notification)}
                className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-white px-3 text-xs font-medium text-ink hover:bg-page"
              >
                Open
              </button>
            ) : null}
            {notification.isRead ? null : (
              <button
                type="button"
                onClick={() => onMarkRead(notification)}
                className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-white px-3 text-xs font-medium text-ink hover:bg-page"
              >
                Mark as read
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The inbox for both roles: a student's own notifications, or the one inbox shared by all staff. */
export function InboxPage() {
  const { state } = useAuth();
  const role = state.status === 'authenticated' ? state.user.role : 'student';
  const navigate = useNavigate();
  const { setUnreadCount } = useUnread();
  const resource = useApi(() => api.notifications(role, { limit: 100 }), [role]);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<InboxCategory>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<NotificationView | null>(null);

  const all = resource.status === 'ready' ? resource.data.notifications : [];
  const counts = useMemo(() => categoryCounts(all), [all]);
  const filtered = useMemo(() => filterInbox(all, category, unreadOnly), [all, category, unreadOnly]);
  const paged = pageOf(filtered, page);

  async function markRead(notification: NotificationView) {
    setError(null);
    try {
      const { unreadCount } = await api.markNotificationRead(role, notification.id);
      setUnreadCount(unreadCount);
      resource.reload();
    } catch (caught) {
      setError(toApiError(caught).message);
    }
  }

  async function open(notification: NotificationView) {
    if (!notification.isRead) await markRead(notification);
    if (notification.href) navigate(notification.href);
  }

  async function markAll() {
    setError(null);
    try {
      const { unreadCount } = await api.markAllNotificationsRead(role);
      setUnreadCount(unreadCount);
      resource.reload();
    } catch (caught) {
      setError(toApiError(caught).message);
    }
  }

  const chips = (Object.keys(INBOX_CATEGORY_LABEL) as InboxCategory[]).filter((key) => key === 'all' || counts[key] > 0 || key === category);

  return (
    <>
      <PageHeader
        title="Inbox"
        subtitle={
          role === 'staff'
            ? 'Updates for the SDO office. This inbox is shared: reading one marks it read for every staff member.'
            : 'Updates from the SDO office about your cases, sanctions and appointments.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={resource.reload}
              aria-label="Refresh the inbox"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-line-strong bg-white text-ink hover:bg-page"
            >
              <Icon name="refresh" className="text-base" />
            </button>
            {resource.status === 'ready' && resource.data.unreadCount > 0 ? (
              <button type="button" className={`${buttonClass} min-h-11`} onClick={() => void markAll()}>
                Mark all as read
              </button>
            ) : null}
          </div>
        }
      />
      {role === 'student' ? (
        <p className="mb-3 text-xs text-muted">Updates are also emailed to your school account.</p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      {resource.status === 'loading' ? <LoadingState label="Loading your inbox…" /> : null}
      {resource.status === 'error' ? <ErrorState message={resource.error.message} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' ? (
        all.length === 0 ? (
          <EmptyState title="No notifications yet." hint="Updates from the office will show up here." />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
                {chips.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={category === key}
                    onClick={() => {
                      setCategory(key);
                      setPage(1);
                    }}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm font-medium ${
                      category === key ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
                    }`}
                  >
                    {INBOX_CATEGORY_LABEL[key]}
                    <span className="rounded-full bg-black/10 px-1.5 text-xs">{counts[key]}</span>
                  </button>
                ))}
              </div>
              <label className="ml-auto flex min-h-11 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(event) => {
                    setUnreadOnly(event.target.checked);
                    setPage(1);
                  }}
                />
                Unread only
              </label>
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="Nothing matches." hint="Change the filter to see more." />
            ) : (
              <>
                <NotificationList
                  notifications={paged.rows}
                  onOpen={(notification) => void open(notification)}
                  onMarkRead={(notification) => void markRead(notification)}
                  onView={setViewing}
                />
                {paged.pages > 1 ? (
                  <nav className="mt-4 flex items-center justify-between gap-2 text-sm" aria-label="Pagination">
                    <button
                      type="button"
                      className="min-h-11 rounded-md border border-line-strong bg-white px-3 font-medium disabled:opacity-50"
                      disabled={paged.page <= 1}
                      onClick={() => setPage(paged.page - 1)}
                    >
                      Previous
                    </button>
                    <span className="text-muted">
                      Page {paged.page} of {paged.pages} · {filtered.length} messages
                    </span>
                    <button
                      type="button"
                      className="min-h-11 rounded-md border border-line-strong bg-white px-3 font-medium disabled:opacity-50"
                      disabled={paged.page >= paged.pages}
                      onClick={() => setPage(paged.page + 1)}
                    >
                      Next
                    </button>
                  </nav>
                ) : null}
              </>
            )}
          </>
        )
      ) : null}

      <ConfirmModal
        open={viewing !== null}
        title={viewing?.title ?? ''}
        description={
          viewing ? (
            <>
              <p className="whitespace-pre-line">{viewing.message}</p>
              <p className="mt-2 text-xs text-muted">{formatDateTime(viewing.dateCreated)}</p>
            </>
          ) : null
        }
        confirmLabel={viewing?.href ? 'Open' : 'Close'}
        onClose={() => setViewing(null)}
        onConfirm={async () => {
          const target = viewing;
          setViewing(null);
          if (target) await open(target);
        }}
      />
    </>
  );
}
