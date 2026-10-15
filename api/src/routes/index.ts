import type { Express } from 'express';
import type { AppointmentQueries } from '../repositories/appointments/queries.js';
import { createAppointmentRouter } from './appointments.routes.js';
import type { AppointmentService } from '../services/appointments.service.js';
import type { CaseQueries } from '../repositories/cases/queries.js';
import type { ClearanceQueries } from '../repositories/clearance/queries.js';
import { createClearanceRouter } from './clearance.routes.js';
import type { ClearanceService } from '../services/clearance.service.js';
import { createCaseRouter } from './cases.routes.js';
import type { CaseService } from '../services/cases.service.js';
import { createGateRouter } from './gate.routes.js';
import type { GateLimits } from '../config/gate.js';
import type { GateService } from '../services/gate.service.js';
import type { GateOptionsReader } from '../repositories/gate/types.js';
import type { HandbookAdminService } from '../services/handbook-admin.service.js';
import { createHandbookRouter } from './handbook.routes.js';
import type { TemplateReader } from '../repositories/templates/reader.js';
import { createTemplateRouter } from './templates.routes.js';
import type { TemplateService } from '../services/templates.service.js';
import type { HandbookRepo } from '../repositories/handbook/repo.js';
import { createAvatarRouter } from './avatar.routes.js';
import type { AvatarService } from '../services/avatar.service.js';
import { createMeRouter } from './me.routes.js';
import { createNoticeRouter } from './notices.routes.js';
import type { NoticeService } from '../services/notices.service.js';
import type { NoticeStore } from '../repositories/notices/types.js';
import { createStudentsRouter } from './students.routes.js';
import type { InboxStore } from '../services/notifications/inbox.js';
import { createNotificationsRouter } from './notifications.routes.js';
import { createSanctionRouter } from './sanctions.routes.js';
import type { SanctionService } from '../services/sanctions.service.js';
import type { StudentViewRepo } from '../repositories/me/repo.js';

/** Everything the data routers need, built by `server.ts` (real stores) or the test harness (in-memory fakes). */
export interface DataDeps {
    handbook: HandbookRepo;
    /** Staff create and edit violations (SPEC 4.9). */
    handbookAdmin?: { service: HandbookAdminService };
    /** The public gate form: no sign-in, protected by verifyHuman() and per-IP limits (SPEC 4.10). */
    gate?: { service: GateService; options: GateOptionsReader; limits?: GateLimits };
    /** Sanction templates: text and files (SPEC 6.1). */
    templates?: { service: TemplateService; reader: TemplateReader };
    studentViews: StudentViewRepo;
    /** Profile pictures for both roles (SPEC 4.8). Needs file storage; omitted in tests that do not use it. */
    avatar?: { service: AvatarService };
    /** Staff case workflow: the rules (service) and the read side (queries). */
    cases?: { service: CaseService; queries: CaseQueries };
    /** Sanction assignment, proof files and verification. */
    sanctions?: { service: SanctionService };
    /** Staff appointment workflow: the rules (service) and the read side (queries). */
    appointments?: { service: AppointmentService; queries: AppointmentQueries };
    /** Staff clearance workflow: the rules (service) and the read side (queries). */
    clearance?: { service: ClearanceService; queries: ClearanceQueries };
    /** Staff notices: broadcast, edit, remove (UI-POLISH-SPEC decision 1). */
    notices?: { service: NoticeService; store: NoticeStore; onPublished?: () => void };
    /** The in-app inbox: a student's own, and the single shared staff inbox. */
    notifications?: { inbox: InboxStore };
    /** Injected so tests control "today" (Asia/Manila). */
    now?: () => Date;
}

/** Mounts every feature router, in one place, after sign-in and session handling are in place. */
export function registerDataRoutes(app: Express, data: DataDeps, sessionSecret: string): void {
  if (data.gate) {
    app.use(createGateRouter({ ...data.gate, secret: sessionSecret, now: data.now }));
  }
  app.use(createHandbookRouter({ repo: data.handbook, admin: data.handbookAdmin?.service }));
  if (data.templates) app.use(createTemplateRouter(data.templates));
  // Before the student-only /me router: staff change their own picture too.
  if (data.avatar) app.use(createAvatarRouter(data.avatar));
  app.use(createMeRouter({ repo: data.studentViews, now: data.now }));
  app.use(createStudentsRouter({ repo: data.studentViews, now: data.now }));
  if (data.cases) app.use(createCaseRouter({ ...data.cases, now: data.now }));
  if (data.sanctions) app.use(createSanctionRouter({ service: data.sanctions.service, now: data.now }));
  if (data.appointments) app.use(createAppointmentRouter({ ...data.appointments, now: data.now }));
  if (data.clearance) app.use(createClearanceRouter({ ...data.clearance, now: data.now }));
  if (data.notices) app.use(createNoticeRouter({ ...data.notices, now: data.now }));
  if (data.notifications) app.use(createNotificationsRouter({ store: data.notifications.inbox }));
}
