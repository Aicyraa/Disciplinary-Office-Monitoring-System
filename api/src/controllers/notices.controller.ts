import type { RequestHandler } from 'express';
import type { AuthUser, NoticeListResponse } from '@shared/types.js';
import { sendError, sendNotFound, sendOk } from '../helpers/http.js';
import { parseId } from '../helpers/params.js';
import { manilaToday } from '../views/me.views.js';
import type { NoticeFailure, NoticeService } from '../services/notices.service.js';
import type { NoticeStore } from '../repositories/notices/types.js';

export interface NoticeControllerDeps {
  service: NoticeService;
  store: NoticeStore;
  /** Called after a notice is saved, so the delivery sweep sends the emails without waiting for its timer. */
  onPublished?: () => void;
  now: () => Date;
}

function sendNoticeFailure(response: Parameters<RequestHandler>[1], failure: NoticeFailure): void {
  sendError(response, failure.code === 'not_found' ? 404 : 400, failure.code, failure.message);
}

/**
 * Staff notices (UI-POLISH-SPEC decision 1): publish a broadcast with an optional expiry, edit it, remove it.
 * Students never call these; they read a notice as a notification in their inbox.
 */
export function createNoticeController({ service, store, onPublished, now }: NoticeControllerDeps) {
  const list: RequestHandler = async (_request, response) => {
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
  };

  const publish: RequestHandler = async (request, response) => {
    const user = request.user as AuthUser;
    const result = await service.publish({ employeeId: user.id, ...(request.body ?? {}) });
    if (!result.ok) return sendNoticeFailure(response, result);
    onPublished?.();
    sendOk(response, { noticeId: result.noticeId, recipients: result.recipients }, 201);
  };

  const edit: RequestHandler = async (request, response) => {
    const id = parseId(String(request.params.id));
    if (id === null) return sendNotFound(response);
    const result = await service.edit({ noticeId: id, ...(request.body ?? {}) });
    if (!result.ok) return sendNoticeFailure(response, result);
    sendOk(response, { ok: true });
  };

  const remove: RequestHandler = async (request, response) => {
    const id = parseId(String(request.params.id));
    if (id === null) return sendNotFound(response);
    const result = await service.remove(id);
    if (!result.ok) return sendNoticeFailure(response, result);
    sendOk(response, { ok: true });
  };

  return { list, publish, edit, remove };
}
