import { Router } from 'express';
import { requireStaff } from '../middlewares/auth.js';
import { createAppointmentController } from '../controllers/appointments.controller.js';
import type { AppointmentQueries } from '../repositories/appointments/queries.js';
import type { AppointmentService } from '../services/appointments.service.js';

export interface AppointmentRouterOptions {
  service: AppointmentService;
  queries: AppointmentQueries;
  /** Injected so tests control "today" (Asia/Manila). */
  now?: () => Date;
}

/** Staff appointment workflow (SPEC 4.5, 7). Wiring only: every route needs a staff session. */
export function createAppointmentRouter({ service, queries, now = () => new Date() }: AppointmentRouterOptions): Router {
  const router = Router();
  const appointments = createAppointmentController({ service, queries, now });
  router.use('/appointments', ...requireStaff);

  router.get('/appointments', appointments.list);
  router.get('/appointments/:id', appointments.detail);
  router.post('/appointments', appointments.create);
  router.patch('/appointments/:id', appointments.update);
  router.post('/appointments/:id/complete', appointments.complete);
  router.post('/appointments/:id/cancel', appointments.cancel);

  return router;
}
