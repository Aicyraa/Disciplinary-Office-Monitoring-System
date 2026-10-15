import { Router } from 'express';
import { createAvatarController } from '../controllers/avatar.controller.js';
import { requireAuth, requirePasswordChanged } from '../middlewares/auth.js';
import { createAvatarReceiver } from '../middlewares/upload.js';
import type { AvatarService } from '../services/avatar.service.js';

/**
 * `PUT` and `DELETE /me/avatar` for both roles (SPEC 4.8). Mounted before the student-only `/me` router, so a
 * staff member reaches it too; the id always comes from the session. Wiring only.
 */
export function createAvatarRouter({ service }: { service: AvatarService }): Router {
  const router = Router();
  const avatar = createAvatarController({ service });
  const guard = [requireAuth, requirePasswordChanged];

  router.put('/me/avatar', ...guard, createAvatarReceiver(), avatar.put);
  router.delete('/me/avatar', ...guard, avatar.remove);
  return router;
}
