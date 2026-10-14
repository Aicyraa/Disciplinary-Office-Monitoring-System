import { Router } from 'express';
import { requireStudent } from '../middlewares/auth.js';
import { createMeController } from '../controllers/me.controller.js';
import type { StudentViewRepo } from '../repositories/me/repo.js';

export interface MeRouterOptions {
  repo: StudentViewRepo;
  now?: () => Date;
}

/** `/me/*`: a student's own data, read-only (SPEC 7). Wiring only. */
export function createMeRouter({ repo, now = () => new Date() }: MeRouterOptions): Router {
  const router = Router();
  const me = createMeController({ repo, now });
  router.use('/me', ...requireStudent);

  router.get('/me/profile', me.profile);
  router.get('/me/cases', me.cases);
  router.get('/me/cases/:id', me.caseDetail);
  router.get('/me/sanctions', me.sanctions);
  router.get('/me/appointments', me.appointments);
  router.get('/me/clearance', me.clearance);
  router.get('/me/clearance/slip', me.clearanceSlip);

  return router;
}
