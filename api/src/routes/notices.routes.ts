import { Router, type Response } from 'express';
import type { AuthUser, NoticeListResponse } from '@shared/types.js';
import { requireStaff } from '../middlewares/auth.js';
import { sendError, sendOk } from '../helpers/http.js';
import { manilaToday } from '../views/me.views.js';
import type { NoticeFailure, NoticeService } from '../services/notices.service.js';
import type { NoticeStore } from '../types/notices.types.js';
import { parseId } from '../helpers/params.js';

export interface NoticeRouterOptions {
  service: NoticeService;
  store: NoticeStore;
  /** Called after a notice is saved, so the delivery sweep sends the emails without waiting for its timer. */
  onPublished?: () => void;
  now?: () => Date;
}


function sendFailure(response: Response, failure: NoticeFailure): void {
  sendError(response, failure.code === 'not_found' ? 404 : 400, failure.code, failure.message);
}

/**
 * Staff notices (UI-POLISH-SPEC decision 1): publish a broadcast with an optional expiry, edit it, remove it.
 * Students never call these routes; they read a notice as a notification in their inbox.
 */
export function createNoticeRouter({ service, store, onPublished, now = () => new Date() }: NoticeRouterOptions): Router {
  const router = Router();
  router.use('/notices', ...requireStaff);

  router.get('/notices', async (_request, response) => {
    const today = manilaToday(now());
    const rows = await store.list();
    const body: NoticeListResponse = {
      notices: rows.map((row) => ({
        id: row.noticeId,
        title: row.title,
        message: row.message,
        instructions: row.instructions,
        expiresOn: row.expiresOn,
        expired: row.expiresOn !== null && row.expiresOn < today,
        createdBy: row.createdBy,
        dateCreated: row.dateCreated.toISOString(),
        dateUpdated: row.dateUpdated.toISOString(),
        recipients: row.recipients,
      })),
    };
    sendOk(response, body);
  });

  router.post('/notices', async (request, response) => {
    const user = request.user as AuthUser;
    const result = await service.publish({ employeeId: user.id, ...(request.body ?? {}) });
    if (!result.ok) return sendFailure(response, result);
    onPublished?.();
    sendOk(response, { noticeId: result.noticeId, recipients: result.recipients }, 201);
  });

  router.patch('/notices/:id', async (request, response) => {
    const id = parseId(String(request.params.id));
    if (id === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.edit({ noticeId: id, ...(request.body ?? {}) });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  router.delete('/notices/:id', async (request, response) => {
    const id = parseId(String(request.params.id));
    if (id === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.remove(id);
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  return router;
}
