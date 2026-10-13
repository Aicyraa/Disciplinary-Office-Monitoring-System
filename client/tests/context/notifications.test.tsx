import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, test } from 'vitest';
import type { NotificationView } from '@shared/types';
import { api, http } from '@/api/client';
import { NotificationList } from '@/pages/shared/Inbox';
import { badgeText, unreadMessage } from '@/context/UnreadContext';

describe('badgeText and unreadMessage', () => {
  test.each([
    [0, null],
    [-3, null],
    [1, '1'],
    [99, '99'],
    [100, '99+'],
    [2500, '99+'],
  ])('badge for %i is %j', (count, expected) => {
    expect(badgeText(count)).toBe(expected);
  });

  test('the toast says one or many correctly', () => {
    expect(unreadMessage(1)).toBe('You have 1 unread notification.');
    expect(unreadMessage(4)).toBe('You have 4 unread notifications.');
  });
});

const view = (overrides: Partial<NotificationView> = {}): NotificationView => ({
  id: 1,
  kind: 'sanction',
  title: 'Sanction verified',
  message: 'Your CATEGORY - 1 was verified as completed.',
  isRead: false,
  dateCreated: '2026-10-12T02:00:00.000Z',
  href: '/sanctions',
  ...overrides,
});

describe('NotificationList', () => {
  const render = (items: NotificationView[]) =>
    renderToStaticMarkup(<NotificationList notifications={items} onOpen={() => {}} onMarkRead={() => {}} />);

  test('an unread notification is marked New and can be opened and marked read', () => {
    const html = render([view()]);
    expect(html).toContain('Sanction verified');
    expect(html).toContain('New');
    expect(html).toContain('Open');
    expect(html).toContain('Mark as read');
  });

  test('a read notification has no New badge and no Mark as read', () => {
    const html = render([view({ isRead: true })]);
    expect(html).not.toContain('>New<');
    expect(html).not.toContain('Mark as read');
  });

  test('a notification without a page has no Open button', () => {
    expect(render([view({ href: null })])).not.toContain('>Open<');
  });

  test('message text is rendered as text, never as markup', () => {
    const html = render([view({ message: '<img src=x onerror=alert(1)>' })]);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });

  test('the date is shown in Manila time', () => {
    expect(render([view({ dateCreated: '2026-10-11T20:00:00.000Z' })])).toContain('Oct 12, 2026');
  });
});

describe('inbox API calls choose the route by role', () => {
  const original = http.defaults.adapter;
  afterEach(() => {
    http.defaults.adapter = original;
  });

  function recording() {
    const calls: Array<{ method?: string; url?: string; params?: unknown }> = [];
    const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
      calls.push({ method: config.method, url: config.url, params: config.params });
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: { ok: true, data: { notifications: [], unreadCount: 0 } },
      };
    };
    http.defaults.adapter = adapter;
    return calls;
  }

  test('a student uses /me/notifications', async () => {
    const calls = recording();
    await api.notifications('student', { limit: 5, unread: true });
    await api.markNotificationRead('student', 7);
    await api.markAllNotificationsRead('student');
    expect(calls).toEqual([
      { method: 'get', url: '/me/notifications', params: { limit: 5, unread: 'true' } },
      { method: 'post', url: '/me/notifications/7/read', params: undefined },
      { method: 'post', url: '/me/notifications/read-all', params: undefined },
    ]);
  });

  test('staff use the shared /notifications inbox', async () => {
    const calls = recording();
    await api.notifications('staff');
    await api.markNotificationRead('staff', 9);
    expect(calls.map((call) => call.url)).toEqual(['/notifications', '/notifications/9/read']);
  });

  test('a failing refresh rejects with an ApiError (the badge handles it quietly)', async () => {
    http.defaults.adapter = () => Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK'));
    await expect(api.notifications('student')).rejects.toMatchObject({ name: 'ApiError', status: 0 });
  });
});
