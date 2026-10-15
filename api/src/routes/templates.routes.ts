import { Router } from 'express';
import { requireAuth, requirePasswordChanged, requireStaff } from '../middlewares/auth.js';
import { createUploadReceiver } from '../middlewares/upload.js';
import { createTemplateController } from '../controllers/templates.controller.js';
import type { TemplateReader } from '../repositories/templates/reader.js';
import { FILES_PER_TEMPLATE, type TemplateService } from '../services/templates.service.js';

export interface TemplateRouterOptions {
  service: TemplateService;
  reader: TemplateReader;
}

/** Sanction templates (SPEC 4.9, 6.1, 7). Wiring only; a template holds one file and an upload replaces it. */
export function createTemplateRouter({ service, reader }: TemplateRouterOptions): Router {
  const router = Router();
  const templates = createTemplateController({ service, reader });
  const receive = createUploadReceiver({
    maxFiles: FILES_PER_TEMPLATE,
    tooManyMessage: 'A template holds one file. Upload a single file; it replaces the current one.',
  });

  router.get('/sanction-templates', requireAuth, requirePasswordChanged, templates.list);
  router.get('/sanction-templates/files/:fileId/url', requireAuth, requirePasswordChanged, templates.fileUrl);
  router.put('/sanction-templates/:sanctionId', ...requireStaff, templates.saveText);
  router.post('/sanction-templates/:sanctionId/files', ...requireStaff, receive, templates.uploadFiles);
  router.delete('/sanction-templates/files/:fileId', ...requireStaff, templates.removeFile);

  return router;
}
