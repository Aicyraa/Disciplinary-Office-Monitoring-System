import { Router } from 'express';
import { requireStaff } from '../middlewares/auth.js';
import { createCaseController } from '../controllers/cases.controller.js';
import type { CaseQueries } from '../repositories/cases/queries.js';
import type { CaseService } from '../services/cases.service.js';

export interface CaseRouterOptions {
  service: CaseService;
  queries: CaseQueries;
  /** Injected so tests control "today" (Asia/Manila). */
  now?: () => Date;
}

/** Staff case workflow (SPEC 7). Wiring only: guards here, parsing in controllers, rules in CaseService. */
export function createCaseRouter({ service, queries, now = () => new Date() }: CaseRouterOptions): Router {
  const router = Router();
  const cases = createCaseController({ service, queries, now });
  router.use(['/cases', '/submissions', '/case-sanctions'], ...requireStaff);

  router.get('/cases', cases.list);
  router.get('/cases/:id', cases.detail);
  router.get('/case-sanctions', cases.sanctionQueue);
  router.post('/cases', cases.record);
  router.get('/submissions/:ref/escalation-preview', cases.previewEscalation);
  router.post('/submissions/:ref/validate', cases.validateSubmission);
  router.post('/submissions/:ref/reject', cases.rejectSubmission);
  router.patch('/cases/:id/student', cases.linkStudent);
  router.post('/cases/:id/resolve', cases.resolve);
  router.post('/cases/:id/resolve-without-sanction', cases.resolveWithoutSanction);
  router.post('/cases/:id/remarks', cases.addRemark);

  return router;
}
