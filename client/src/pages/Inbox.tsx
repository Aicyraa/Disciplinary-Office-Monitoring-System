import { useNavigate } from 'react-router-dom';
import type { NotificationKind, NotificationView } from '@shared/types';
import { useAuth } from '../auth/AuthContext';
import { Card, EmptyState, Icon, PageHeader, Resource, buttonClass } from '../components/ui';
import { api, toApiError } from '../lib/api';
import { formatDateTime } from '../lib/format';
import { useApi } from '../lib/useApi';
import { useUnread } from '../notifications/UnreadContext';
import { useState } from 'react';

const KIND_ICON: Record<NotificationKind, string> = {
  report: 'report',
  case: 'folder_open',
  esc: 'priority_high',
  sanction: 'assignment',
  appt: 'event',
  clr: 'verified_user',
  account: 'manage_accounts',
  newviol: 'gavel',
};

/** Presentational list, so it can be rendered and tested without the network. */
export function NotificationList({
  notifications,
  onOpen,
  onMarkRead,
}: {
  notifications: NotificationView[];
  onOpen: (notification: NotificationView) => void;
  onMarkRead: (notification: NotificationView) => void;
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
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            {notification.href ? (
              <button
                type="button"
                onClick={() => onOpen(notification)}
                className="rounded-md border border-line-strong bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-page"
              >
                Open
              </button>
            ) : null}
            {notification.isRead ? null : (
              <button
                type="button"
                onClick={() => onMarkRead(notification)}
                className="rounded-md border border-line-strong bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-page"
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
          resource.status === 'ready' && resource.data.unreadCount > 0 ? (
            <button type="button" className={buttonClass} onClick={() => void markAll()}>
              Mark all as read
            </button>
          ) : undefined
        }
      />
      {error ? (
        <p role="alert" className="mb-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <Resource resource={resource} onRetry={resource.reload}>
        {({ notifications }) =>
          notifications.length === 0 ? (
            <EmptyState title="No notifications yet." hint="Updates from the office will show up here." />
          ) : (
            <Card className="border-0 bg-transparent p-0">
              <NotificationList
                notifications={notifications}
                onOpen={(notification) => void open(notification)}
                onMarkRead={(notification) => void markRead(notification)}
              />
            </Card>
          )
        }
      </Resource>
    </>
  );
}
