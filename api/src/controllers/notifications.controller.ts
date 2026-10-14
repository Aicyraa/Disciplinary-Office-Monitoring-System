import type { Request, RequestHandler } from 'express';
import type { NotificationListResponse } from '@shared/types.js';
import { sendError, sendOk } from '../helpers/http.js';
import { parseId } from '../helpers/params.js';
import { toNotificationView, type Audience, type InboxStore } from '../services/notifications/inbox.js';
import { parseInboxQuery } from '../validators/notifications.validators.js';

/**
 * Inbox handlers (SPEC 7). Students read their own rows; staff share one inbox, so marking one read marks it
 * read for all staff (the database keeps a single row per notification). `audienceOf` says whose inbox it is.
 */
export function createNotificationsController({ store }: { store: InboxStore }) {
  return (audienceOf: (request: Request) => Audience) => {
    const list: RequestHandler = async (request, response) => {
      const input = parseInboxQuery(request.query);
      if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
      const audience = audienceOf(request);
      const rows = await store.list(audience, input.value);
      const body: NotificationListResponse = {
        notifications: rows.map((row) => toNotificationView(row, audience)),
        unreadCount: await store.unreadCount(audience),
      };
      sendOk(response, body);
    };

    const readAll: RequestHandler = async (request, response) => {
      const audience = audienceOf(request);
      await store.markAllRead(audience);
      sendOk(response, { unreadCount: await store.unreadCount(audience) });
    };

    const readOne: RequestHandler = async (request, response) => {
      const id = parseId(request.params.id);
      const audience = audienceOf(request);
      // Someone else's notification is a 404, identical to a missing one.
      if (id === null || !(await store.markRead(audience, id))) {
        return sendError(response, 404, 'not_found', 'Notification not found.');
      }
      sendOk(response, { unreadCount: await store.unreadCount(audience) });
    };

    return { list, readAll, readOne };
  };
}
