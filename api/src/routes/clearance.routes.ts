import { Router } from 'express';
import { requireStaff } from '../middlewares/auth.js';
import { createClearanceController } from '../controllers/clearance.controller.js';
import type { ClearanceQueries } from '../repositories/clearance/queries.js';
import type { ClearanceService } from '../services/clearance.service.js';

export interface ClearanceRouterOptions {
  service: ClearanceService;
  queries: ClearanceQueries;
  /** Injected so tests control "today" (the current term). */
  now?: () => Date;
}

/** Staff clearance workflow (SPEC 4.4, 7). Wiring only: every route needs a staff session. */
export function createClearanceRouter({ service, queries, now = () => new Date() }: ClearanceRouterOptions): Router {
  const router = Router();
  const clearances = createClearanceController({ service, queries, now });
  router.use('/clearances', ...requireStaff);

  // UI-POLISH-SPEC D3. Registered before `/clearances/:id` so "terms" is never read as an id.
  router.get('/clearances/terms', clearances.terms);
  router.get('/clearances/terms/:year/:semester/students', clearances.roster);
  router.get('/clearances', clearances.list);
  router.get('/clearances/:id', clearances.detail);
  router.post('/clearances', clearances.setUp);
  router.post('/clearances/:id/requirements', clearances.addRequirement);
  router.delete('/clearances/:id/requirements/:rid', clearances.removeRequirement);
  router.post('/clearances/:id/requirements/:rid/complete', clearances.markDone);
  router.post('/clearances/:id/requirements/:rid/reverse', clearances.reverse);

  return router;
}
