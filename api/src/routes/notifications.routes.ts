import { Router } from 'express';
import { requireStaff, requireStudent } from '../middlewares/auth.js';
import { createNotificationsController } from '../controllers/notifications.controller.js';
import { sessionUserId } from '../helpers/params.js';
import type { InboxStore } from '../services/notifications/inbox.js';

/**
 * Inbox routes (SPEC 7). Students read `/me/notifications`; staff share one inbox, `/notifications`.
 * `read-all` is registered before `:id/read`; the paths differ in length so they cannot clash.
 */
export function createNotificationsRouter({ store }: { store: InboxStore }): Router {
  const router = Router();
  const forAudience = createNotificationsController({ store });

  const students = forAudience((request) => ({ kind: 'student', studentId: sessionUserId(request) }));
  router.get('/me/notifications', ...requireStudent, students.list);
  router.post('/me/notifications/read-all', ...requireStudent, students.readAll);
  router.post('/me/notifications/:id/read', ...requireStudent, students.readOne);

  const staff = forAudience(() => ({ kind: 'staff' }));
  router.get('/notifications', ...requireStaff, staff.list);
  router.post('/notifications/read-all', ...requireStaff, staff.readAll);
  router.post('/notifications/:id/read', ...requireStaff, staff.readOne);

  return router;
}
