import type { AccountRole, NotificationListResponse } from '@shared/types';
import { get, post } from './client';

const inboxBase = (role: AccountRole): string => (role === 'staff' ? '/notifications' : '/me/notifications');

export const notificationsApi = {
  // Notifications (SPEC 7): students read `/me/notifications`; staff share one inbox at `/notifications`.
  notifications: (role: AccountRole, query: { limit?: number; unread?: boolean } = {}) => {
    const params: Record<string, string | number> = {};
    if (query.limit !== undefined) params.limit = query.limit;
    if (query.unread !== undefined) params.unread = String(query.unread);
    return get<NotificationListResponse>(inboxBase(role), params);
  },
  markNotificationRead: (role: AccountRole, id: number) =>
    post<{ unreadCount: number }>(`${inboxBase(role)}/${id}/read`),
  markAllNotificationsRead: (role: AccountRole) => post<{ unreadCount: number }>(`${inboxBase(role)}/read-all`),
};
