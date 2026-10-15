import { Router } from 'express';
import { requireJobKey } from '../middlewares/jobKey.js';
import { createClearanceJobController } from '../controllers/clearance-job.controller.js';
import type { ClearanceService } from '../services/clearance.service.js';

export interface ClearanceJobRouterOptions {
  service: ClearanceService;
  /** The configured `PA_JOB_KEY`, read per request (config/env.ts). */
  jobKey: () => string | undefined;
  now?: () => Date;
}

/**
 * Scheduled jobs (Power Automate Recurrence -> HTTP). No session: the `X-SDO-Job-Key` header is the credential.
 * The body may name the term (`academicYear`, `semester`); an empty body means the current term.
 */
export function createClearanceJobRouter({ service, jobKey, now = () => new Date() }: ClearanceJobRouterOptions): Router {
  const router = Router();
  const jobs = createClearanceJobController({ service, now });
  router.post('/internal/clearances/term-setup', requireJobKey(jobKey), jobs.termSetup);
  return router;
}
