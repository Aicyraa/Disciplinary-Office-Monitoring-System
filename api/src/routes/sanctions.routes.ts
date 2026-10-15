import { Router } from 'express';
import { requireAuth, requirePasswordChanged, requireStaff, requireStudent } from '../middlewares/auth.js';
import { createUploadReceiver } from '../middlewares/upload.js';
import { MAX_FILES_PER_SANCTION } from '../domain/files/validate.js';
import { createSanctionController } from '../controllers/sanctions.controller.js';
import type { SanctionService } from '../services/sanctions.service.js';

export interface SanctionRouterOptions {
  service: SanctionService;
  now?: () => Date;
}

/** Sanction assignment, proof files and staff verification (SPEC 4.3, 6.1, 7). Wiring only. */
export function createSanctionRouter({ service, now = () => new Date() }: SanctionRouterOptions): Router {
  const router = Router();
  const sanctions = createSanctionController({ service, now });
  const receive = createUploadReceiver({
    maxFiles: MAX_FILES_PER_SANCTION,
    tooManyMessage: 'You can upload only one file per sanction.',
  });

  // staff: assign and review
  router.get('/cases/:id/sanction-options', ...requireStaff, sanctions.options);
  router.post('/cases/:id/sanctions', ...requireStaff, sanctions.assign);
  router.post('/case-sanctions/:id/verify', ...requireStaff, sanctions.verify);
  router.post('/case-sanctions/:id/return', ...requireStaff, sanctions.returnForRevision);

  // student: proof files
  router.post('/files', ...requireStudent, receive, sanctions.uploadProof);
  router.delete('/files/:id', ...requireStudent, sanctions.removeProof);
  // the owning student or any staff member
  router.get('/files/:id/url', requireAuth, requirePasswordChanged, sanctions.fileUrl);

  return router;
}
