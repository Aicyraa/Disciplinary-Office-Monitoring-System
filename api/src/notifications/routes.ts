import { Router } from 'express';
import type { NotificationListResponse } from '@shared/types.js';
import { requireStaff, requireStudent } from '../auth/guards.js';
import { sendError, sendOk } from '../http.js';
import { toNotificationView, type Audience, type InboxStore } from './inbox.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const parseId = (value: unknown): number | null => (typeof value === 'string' && /^\d{1,9}$/.test(value) ? Number(value) : null);

/**
 * Inbox routes (SPEC 7). Students read `/me/notifications` (their own rows). Staff share one inbox,
 * `/notifications`: the rows with recipient_type 'staff', the same for every employee; marking one read marks it
 * read for all staff, because the database keeps a single row per notification.
 */
export function createNotificationsRouter({ store }: { store: InboxStore }): Router {
  const router = Router();

  function mount(base: string, guards: typeof requireStudent, audienceOf: (request: { user?: unknown }) => Audience): void {
    router.get(base, ...guards, async (request, response) => {
      const { limit, unread } = request.query;
      if (limit !== undefined && !(typeof limit === 'string' && /^[1-9]\d{0,2}$/.test(limit))) {
        sendError(response, 400, 'invalid_input', `limit must be a whole number from 1 to ${MAX_LIMIT}.`);
        return;
      }
      if (unread !== undefined && unread !== 'true' && unread !== 'false') {
        sendError(response, 400, 'invalid_input', 'unread must be true or false.');
        return;
      }
      const audience = audienceOf(request);
      const rows = await store.list(audience, {
        limit: Math.min(limit === undefined ? DEFAULT_LIMIT : Number(limit), MAX_LIMIT),
        unreadOnly: unread === 'true',
      });
      const body: NotificationListResponse = {
        notifications: rows.map((row) => toNotificationView(row, audience)),
        unreadCount: await store.unreadCount(audience),
      };
      sendOk(response, body);
    });

    // read-all is registered before :id/read; the paths differ in length so they cannot clash.
    router.post(`${base}/read-all`, ...guards, async (request, response) => {
      const audience = audienceOf(request);
      await store.markAllRead(audience);
      sendOk(response, { unreadCount: await store.unreadCount(audience) });
    });

    router.post(`${base}/:id/read`, ...guards, async (request, response) => {
      const id = parseId(request.params.id);
      const audience = audienceOf(request);
      // Someone else's notification is a 404, identical to a missing one.
      if (id === null || !(await store.markRead(audience, id))) {
        sendError(response, 404, 'not_found', 'Notification not found.');
        return;
      }
      sendOk(response, { unreadCount: await store.unreadCount(audience) });
    });
  }

  mount('/me/notifications', requireStudent, (request) => ({
    kind: 'student',
    studentId: (request.user as { id: string }).id,
  }));
  mount('/notifications', requireStaff, () => ({ kind: 'staff' }));

  return router;
}
