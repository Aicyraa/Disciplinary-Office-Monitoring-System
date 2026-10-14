import { Router } from 'express';
import { requireStaff } from '../middlewares/auth.js';
import { createNoticeController } from '../controllers/notices.controller.js';
import type { NoticeService } from '../services/notices.service.js';
import type { NoticeStore } from '../types/notices.types.js';

export interface NoticeRouterOptions {
  service: NoticeService;
  store: NoticeStore;
  /** Called after a notice is saved, so the delivery sweep sends the emails without waiting for its timer. */
  onPublished?: () => void;
  now?: () => Date;
}

/** Staff notices (UI-POLISH-SPEC decision 1). Wiring only. */
export function createNoticeRouter({ service, store, onPublished, now = () => new Date() }: NoticeRouterOptions): Router {
  const router = Router();
  const notices = createNoticeController({ service, store, onPublished, now });
  router.use('/notices', ...requireStaff);

  router.get('/notices', notices.list);
  router.post('/notices', notices.publish);
  router.patch('/notices/:id', notices.edit);
  router.delete('/notices/:id', notices.remove);

  return router;
}
