import { Router } from 'express';
import { requireAuth, requirePasswordChanged, requireStaff } from '../middlewares/auth.js';
import { createHandbookController } from '../controllers/handbook.controller.js';
import type { HandbookRepo } from '../repositories/handbook/repo.js';
import type { HandbookAdminService } from '../services/handbook-admin.service.js';

/** The handbook (SPEC 4.9). Wiring only: staff-only write routes mount only when the admin service is given. */
export function createHandbookRouter({ repo, admin }: { repo: HandbookRepo; admin?: HandbookAdminService }): Router {
  const router = Router();
  const handbook = createHandbookController({ repo, admin });
  router.use('/handbook', requireAuth, requirePasswordChanged);

  router.get('/handbook', handbook.list);
  router.get('/handbook/:id', handbook.detail);
  if (admin) {
    router.post('/handbook', ...requireStaff, handbook.create);
    router.patch('/handbook/:id', ...requireStaff, handbook.update);
  }

  return router;
}
