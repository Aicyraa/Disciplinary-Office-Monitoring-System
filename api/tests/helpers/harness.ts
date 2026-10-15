import type { NoticeService } from '../../src/services/notices.service.js';
import type { NoticeStore } from '../../src/repositories/notices/types.js';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createMemoryAccountRepo } from '../../src/repositories/auth/memory-repo.js';
import { createAuthService } from '../../src/services/auth.service.js';
import { createAvatarService } from '../../src/services/avatar.service.js';
import type { ObjectStorage } from '../../src/integrations/storage/types.js';
import type { AppointmentQueries } from '../../src/repositories/appointments/queries.js';
import type { AppointmentService } from '../../src/services/appointments.service.js';
import type { CaseQueries } from '../../src/repositories/cases/queries.js';
import type { ClearanceQueries } from '../../src/repositories/clearance/queries.js';
import type { ClearanceService } from '../../src/services/clearance.service.js';
import type { CaseService } from '../../src/services/cases.service.js';
import type { SanctionService } from '../../src/services/sanctions.service.js';
import type { GateLimits } from '../../src/config/gate.js';
import type { GateService } from '../../src/services/gate.service.js';
import type { GateOptionsReader } from '../../src/repositories/gate/types.js';
import type { HandbookAdminService } from '../../src/services/handbook-admin.service.js';
import type { HandbookRepo } from '../../src/repositories/handbook/repo.js';
import type { TemplateReader } from '../../src/repositories/templates/reader.js';
import type { TemplateService } from '../../src/services/templates.service.js';
import { createMemoryHandbookRepo } from '../../src/repositories/handbook/memory-repo.js';
import type { StudentViewRepo } from '../../src/repositories/me/repo.js';
import { createMemoryStudentViewRepo } from '../../src/repositories/me/memory-repo.js';
import type { InboxStore } from '../../src/services/notifications/inbox.js';

/** Fake accounts and an app wired with in-memory repositories. Test-only; never imported by production code. */
export const PASSWORD = 'Passw0rd1';
export const STUDENT_A = { id: '2025-0000001', email: 'ana.cruz@students.nu-fairview.edu.ph' };
export const STUDENT_B = { id: '2025-0000002', email: 'ben.lee@students.nu-fairview.edu.ph' };
export const STAFF = { id: 'E001', email: 'officer@nu-fairview.edu.ph' };
export const STAFF_TEMP = { id: 'E002', email: 'temp@nu-fairview.edu.ph' };
/** A student whose password was reset by staff and must be changed before anything else. */
export const STUDENT_TEMP = { id: '2025-0000003', email: 'tem.po@students.nu-fairview.edu.ph' };

const ROUNDS = 4;

export interface HarnessOptions {
  handbook?: HandbookRepo;
  studentViews?: StudentViewRepo;
  cases?: { service: CaseService; queries: CaseQueries };
  sanctions?: { service: SanctionService };
  appointments?: { service: AppointmentService; queries: AppointmentQueries };
  clearance?: { service: ClearanceService; queries: ClearanceQueries };
  clearanceJob?: { service: ClearanceService; jobKey: () => string | undefined };
  handbookAdmin?: { service: HandbookAdminService };
  gate?: { service: GateService; options: GateOptionsReader; limits?: GateLimits };
  templates?: { service: TemplateService; reader: TemplateReader };
  notifications?: { inbox: InboxStore };
  notices?: { service: NoticeService; store: NoticeStore; onPublished?: () => void };
  onPasswordReset?: (studentId: string) => Promise<void>;
  /** Giving a storage turns on profile pictures (`/me/avatar`) and the `avatarUrl` on the signed-in user. */
  avatarStorage?: ObjectStorage;
  now?: () => Date;
}

export function buildHarnessApp(options: HarnessOptions = {}) {
  const passwordHashed = bcrypt.hashSync(PASSWORD, ROUNDS);
  const account = (role: 'student' | 'staff', id: string, email: string, mustChangePassword = false) => ({
    role,
    id,
    email,
    firstName: 'Fake',
    lastName: id,
    passwordHashed,
    mustChangePassword,
    isActive: true,
  });
  const repo = createMemoryAccountRepo([
    account('student', STUDENT_A.id, STUDENT_A.email),
    account('student', STUDENT_B.id, STUDENT_B.email),
    account('staff', STAFF.id, STAFF.email),
    account('staff', STAFF_TEMP.id, STAFF_TEMP.email, true),
    account('student', STUDENT_TEMP.id, STUDENT_TEMP.email, true),
  ]);
  const storage = options.avatarStorage;
  const authService = createAuthService({
    repo,
    rounds: ROUNDS,
    avatarUrl: storage ? (key) => storage.presignGet(key) : undefined,
  });
  return createApp({
    auth: {
      service: authService,
      sessionSecret: 'test-secret-test-secret-test-secret-1',
      clientOrigin: 'http://localhost:5173',
      loginRateLimit: { windowMs: 60_000, limit: 1000 },
      onPasswordReset: options.onPasswordReset,
    },
    data: {
      handbook: options.handbook ?? createMemoryHandbookRepo(),
      studentViews: options.studentViews ?? createMemoryStudentViewRepo(),
      avatar: storage ? { service: createAvatarService({ repo, storage, loadUser: authService.getUser }) } : undefined,
      cases: options.cases,
      sanctions: options.sanctions,
      appointments: options.appointments,
      clearance: options.clearance,
      clearanceJob: options.clearanceJob,
      handbookAdmin: options.handbookAdmin,
      gate: options.gate,
      templates: options.templates,
      notifications: options.notifications,
      notices: options.notices,
      now: options.now,
    },
  });
}

export async function signedInAgent(app: ReturnType<typeof createApp>, email: string) {
  const agent = request.agent(app);
  const response = await agent.post('/auth/login').send({ email, password: PASSWORD });
  if (response.status !== 200) throw new Error(`Test sign-in failed for ${email}: ${response.status}`);
  return agent;
}
