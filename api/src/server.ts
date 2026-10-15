import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { Pool } from 'pg';
import { createApp } from './app.js';
import { clientOriginFrom, defaultClientOrigin } from './config/cors.js';
import { withExplicitSsl } from './config/db-url.js';
import { createPrismaAccountRepo } from './repositories/auth/prisma-repo.js';
import { createAuthService } from './services/auth.service.js';
import { createAvatarService } from './services/avatar.service.js';
import { createPrismaAppointmentQueries, createPrismaAppointmentStore } from './repositories/appointments/prisma-store.js';
import { createAppointmentService } from './services/appointments.service.js';
import { createPrismaClearanceQueries, createPrismaClearanceStore } from './repositories/clearance/prisma-store.js';
import { createClearanceService } from './services/clearance.service.js';
import { createPrismaCaseQueries, createPrismaCaseStore } from './repositories/cases/prisma-store.js';
import { createCaseService } from './services/cases.service.js';
import { createPrismaHandbookRepo } from './repositories/handbook/prisma-repo.js';
import { createSendToPowerAutomate } from './integrations/power-automate.js';
import { flowUrlsFromEnv, readServerEnv, s3Configured } from './config/env.js';
import { createPrismaStudentViewRepo } from './repositories/me/prisma-repo.js';
import { withAfterCommit } from './services/notifications/after-commit.js';
import { deliverPending, type RetryEntry } from './services/notifications/delivery.js';
import {
  createPrismaInboxStore,
  createPrismaNotificationWriter,
  createPrismaOutboxStore,
} from './repositories/notifications/prisma.js';
import { createDeliveryScheduler, type DeliveryScheduler } from './services/notifications/scheduler.js';
import { createPrismaClient } from './config/prisma.js';
import { createSanctionService } from './services/sanctions.service.js';
import { trustProxyFromEnv } from './config/gate.js';
import { createPrismaGateOptions, createPrismaGateStore } from './repositories/gate/prisma-store.js';
import { createGateService } from './services/gate.service.js';
import { createHandbookAdminService } from './services/handbook-admin.service.js';
import { createPrismaHandbookAdminStore } from './repositories/handbook/admin-prisma-store.js';
import { filesBucketFromEnv, templatesBucketFromEnv } from './config/storage.js';
import { createPrismaTemplateReader, createPrismaTemplateStore } from './repositories/templates/prisma-store.js';
import { createNoticeService } from './services/notices.service.js';
import { createPrismaNoticeStore } from './repositories/notices/prisma-store.js';
import { createTemplateService } from './services/templates.service.js';
import { createS3Storage } from './integrations/storage/s3.js';
import { createUnavailableStorage } from './integrations/storage/unavailable.js';

const { port, isProduction } = readServerEnv();
/** How often the sweep looks for pending notifications (also catches rows left over by an outage). */
const SWEEP_INTERVAL_MS = 60_000;
/** Notifications looked at per pass, and the pause between two requests to the flow (a backlog trickles out). */
const DELIVERY_BATCH = 20;
const PAUSE_BETWEEN_SENDS_MS = 250;

interface Built {
  app: ReturnType<typeof createApp>;
  /** Present only when the full app was built. Started after the server is listening, never in app.ts. */
  scheduler?: DeliveryScheduler;
}

export function buildApp(): Built {
  const env = readServerEnv();
  const { databaseUrl: DATABASE_URL, sessionSecret: SESSION_SECRET } = env;
  // One browser origin, the same in development and production: the client app. `APP_BASE_URL` overrides the
  // default `http://localhost:<CLIENT_PORT>` when the client is hosted elsewhere.
  const configuredOrigin = env.appBaseUrl ?? defaultClientOrigin(env.clientPort);
  const clientOrigin = clientOriginFrom(configuredOrigin);
  console.log(`Browser origin accepted by CORS: ${clientOrigin ?? '(none: invalid APP_BASE_URL)'}`);

  // Development keeps running with a clear 503 on every route (and CORS headers, so the browser shows the
  // reason instead of "cannot reach the server"); production refuses to start.
  const misconfigured = (reason: string): Built => {
    if (isProduction) throw new Error(reason);
    console.warn(`${reason} Serving /health only; every other route answers 503.`);
    return { app: createApp({ unconfigured: { clientOrigin: configuredOrigin, reason } }) };
  };
  if (clientOrigin === null) {
    return misconfigured(`APP_BASE_URL must be a full URL such as http://localhost:5173 (got "${configuredOrigin}").`);
  }
  if (!DATABASE_URL || !SESSION_SECRET) {
    return misconfigured('DATABASE_URL and SESSION_SECRET must be set in the root .env.');
  }
  if (SESSION_SECRET.length < 32) return misconfigured('SESSION_SECRET must be at least 32 characters.');

  const PgStore = connectPgSimple(session);
  const sessionStore = new PgStore({ pool: new Pool({ connectionString: withExplicitSsl(DATABASE_URL) }), createTableIfMissing: true });
  const prisma = createPrismaClient();
  const accountRepo = createPrismaAccountRepo(prisma);

  // Email delivery (POWER-AUTOMATE.md sections 2, 4, 5). Notification rows are written inside each transaction;
  // once it commits, a delivery pass is kicked off in the background, and the sweep retries what stayed pending.
  const flowsConfigured = Boolean(flowUrlsFromEnv().notify);
  if (!flowsConfigured) {
    console.warn('PA_NOTIFY_URL is not set: notification emails are skipped (the in-app inbox still works).');
  }
  // A cursor moves each pass past rows that stayed pending, so a few stuck rows cannot starve newer ones; at the
  // end of the queue it wraps to the start, so the stuck rows are still retried.
  let cursor = 0;
  // One helper and one cooldown memory for the life of the process: a row the flow did not answer for waits
  // (1 minute, doubling, at most 30) instead of being emailed again on every sweep.
  const send = createSendToPowerAutomate({ urls: flowUrlsFromEnv });
  const retryState = new Map<number, RetryEntry>();
  const scheduler = createDeliveryScheduler({
    intervalMs: SWEEP_INTERVAL_MS,
    run: async () => {
      const report = await deliverPending({
        store: createPrismaOutboxStore(prisma),
        send,
        appBaseUrl: clientOrigin,
        afterId: cursor,
        batchSize: DELIVERY_BATCH,
        pauseBetweenMs: PAUSE_BETWEEN_SENDS_MS,
        retryState,
      });
      cursor = report.examined < DELIVERY_BATCH ? 0 : report.lastId;
    },
  });
  const caseStore = withAfterCommit(createPrismaCaseStore(prisma), scheduler.kick);
  const appointmentStore = withAfterCommit(createPrismaAppointmentStore(prisma), scheduler.kick);
  const clearanceStore = withAfterCommit(createPrismaClearanceStore(prisma), scheduler.kick);
  const notificationWriter = createPrismaNotificationWriter(prisma);
  const noticeStore = createPrismaNoticeStore(prisma);

  // File storage is optional in development (everything but proof files keeps working) and required in production.
  const filesBucket = filesBucketFromEnv();
  const bucketConfigured = Boolean(filesBucket && s3Configured());
  if (!bucketConfigured && isProduction) {
    throw new Error('STORAGE_BUCKET_FILES and the AWS_* variables are required in production');
  }
  if (!bucketConfigured) console.warn('Object storage variables missing: proof file upload and download are disabled.');
  const storage =
    bucketConfigured && filesBucket
      ? createS3Storage(filesBucket)
      : createUnavailableStorage('set STORAGE_BUCKET_FILES and the AWS_* keys');

  // Sanction templates have their own bucket and never fall back to the proof-files bucket. Without it the
  // template text still works; only file upload and download answer 503.
  const templatesBucket = templatesBucketFromEnv();
  const templatesConfigured = Boolean(templatesBucket && s3Configured());
  if (!templatesConfigured) console.warn('STORAGE_BUCKET_TEMPLATES is not set: sanction template files are disabled.');
  const templateStorage =
    templatesConfigured && templatesBucket
      ? createS3Storage(templatesBucket)
      : createUnavailableStorage('set STORAGE_BUCKET_TEMPLATES and the AWS_* keys');

  // Profile pictures live in the files bucket (SPEC 6.1); a link that cannot be made is just no picture.
  const service = createAuthService({ repo: accountRepo, avatarUrl: (key) => storage.presignGet(key) });

  const app = createApp({
    auth: {
      service,
      sessionSecret: SESSION_SECRET,
      clientOrigin,
      sessionStore,
      // Secure cookies exactly when the client is served over https (a real deployment). A local production-mode
      // run over http://localhost must still be able to hold a session.
      secureCookies: clientOrigin.startsWith('https:'),
      // How many reverse proxies sit in front of the API (TRUST_PROXY=1 on most hosts). Unset on a laptop.
      trustProxy: trustProxyFromEnv(env.trustProxy),
      // The notification never carries the temporary password.
      onPasswordReset: async (studentId) => {
        await notificationWriter.add({
          recipient: 'student',
          studentId,
          kind: 'account',
          title: 'Your password was reset',
          message:
            'The SDO office reset your password. Sign in with the temporary password you were given, then choose a new one.',
          linkType: 'inbox',
          linkId: null,
          idempotencyKey: `acct:${studentId}:reset:${Date.now()}`,
        });
        scheduler.kick();
      },
    },
    data: {
      handbook: createPrismaHandbookRepo(prisma),
      handbookAdmin: { service: createHandbookAdminService({ store: createPrismaHandbookAdminStore(prisma) }) },
      gate: {
        service: createGateService({ store: createPrismaGateStore(prisma) }),
        options: createPrismaGateOptions(prisma),
      },
      templates: {
        service: createTemplateService({ store: createPrismaTemplateStore(prisma), storage: templateStorage }),
        reader: createPrismaTemplateReader(prisma),
      },
      studentViews: createPrismaStudentViewRepo(prisma),
      avatarUrl: (key) => storage.presignGet(key),
      avatar: { service: createAvatarService({ repo: accountRepo, storage, loadUser: service.getUser }) },
      cases: {
        service: createCaseService({ store: caseStore }),
        queries: createPrismaCaseQueries(prisma),
      },
      sanctions: { service: createSanctionService({ store: caseStore, storage }) },
      clearance: {
        service: createClearanceService({ store: clearanceStore }),
        queries: createPrismaClearanceQueries(prisma),
      },
      appointments: {
        service: createAppointmentService({ store: appointmentStore }),
        queries: createPrismaAppointmentQueries(prisma),
      },
      notices: {
        service: createNoticeService({ store: noticeStore }),
        store: noticeStore,
        onPublished: scheduler.kick,
      },
      notifications: { inbox: createPrismaInboxStore(prisma) },
    },
  });
  return { app, scheduler };
}

// On Vercel the platform owns the listener and `index.ts` imports `buildApp`; there is no long-lived process,
// so neither the listener nor the notification sweep timer starts there.
if (!process.env.VERCEL) {
  const { app, scheduler } = buildApp();
  const server = app.listen(port, () => {
    console.log(`API listening on port ${port}`);
    scheduler?.start();
    scheduler?.kick();
  });

  server.on('error', (error) => {
    console.error(error);
    process.exitCode = 1;
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      scheduler?.stop();
      server.close();
      server.closeAllConnections();
    });
  }
}
