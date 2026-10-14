import { Router } from 'express';
import { requireStaff } from '../middlewares/auth.js';
import { createStudentsController } from '../controllers/students.controller.js';
import type { StudentViewRepo } from '../repositories/me/repo.js';

export interface StudentsRouterOptions {
  repo: StudentViewRepo;
  now?: () => Date;
}

/**
 * Staff student records (SPEC 5). Wiring only. Resetting a password is
 * `POST /staff/students/:id/reset-password` (auth routes).
 */
export function createStudentsRouter({ repo, now = () => new Date() }: StudentsRouterOptions): Router {
  const router = Router();
  const students = createStudentsController({ repo, now });
  router.use('/students', ...requireStaff);

  router.get('/students', students.list);
  router.get('/students/:id', students.record);

  return router;
}
