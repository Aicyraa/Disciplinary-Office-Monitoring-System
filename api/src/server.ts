import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { Pool } from 'pg';
import { createApp } from './app.js';
import { clientOriginFrom, defaultClientOrigin } from './cors.js';
import { withExplicitSsl } from './db-url.js';
import { createPrismaAccountRepo } from './auth/prisma-repo.js';
import { createAuthService } from './auth/service.js';
import { createPrismaAppointmentQueries, createPrismaAppointmentStore } from './appointments/prisma-store.js';
import { createAppointmentService } from './appointments/service.js';
import { createPrismaClearanceQueries, createPrismaClearanceStore } from './clearance/prisma-store.js';
import { createClearanceService } from './clearance/service.js';
import { createPrismaCaseQueries, createPrismaCaseStore } from './cases/prisma-store.js';
import { createCaseService } from './cases/service.js';
import { createPrismaHandbookRepo } from './handbook/prisma-repo.js';
import { createSendToPowerAutomate, urlsFromEnv } from './integrations/power-automate.js';
import { createPrismaStudentViewRepo } from './me/prisma-repo.js';
import { withAfterCommit } from './notifications/after-commit.js';
import { deliverPending, type RetryEntry } from './notifications/delivery.js';
import {
  createPrismaInboxStore,
  createPrismaNotificationWriter,
  createPrismaOutboxStore,
} from './notifications/prisma.js';
import { createDeliveryScheduler, type DeliveryScheduler } from './notifications/scheduler.js';
import { createPrismaClient } from './prisma.js';
import { createSanctionService } from './sanctions/service.js';
import { trustProxyFromEnv } from './gate/config.js';
import { createPrismaGateOptions, createPrismaGateStore } from './gate/prisma-store.js';
import { createGateService } from './gate/service.js';
import { createHandbookAdminService } from './handbook/admin-service.js';
import { createPrismaHandbookAdminStore } from './handbook/admin-prisma-store.js';
import { filesBucketFromEnv, templatesBucketFromEnv } from './storage/config.js';
import { createPrismaTemplateReader, createPrismaTemplateStore } from './templates/prisma-store.js';
import { createTemplateService } from './templates/service.js';
import { createS3Storage } from './storage/s3.js';
import { createUnavailableStorage } from './storage/unavailable.js';

const port = Number(process.env.SERVER_PORT ?? process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === 'production';
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

function buildApp(): Built {
  const { DATABASE_URL, SESSION_SECRET } = process.env;
  // One browser origin, the same in development and production: the client app. `APP_BASE_URL` overrides the
  // default `http://localhost:<CLIENT_PORT>` when the client is hosted elsewhere.
  const configuredOrigin = process.env.APP_BASE_URL ?? defaultClientOrigin(process.env.CLIENT_PORT);
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
  const service = createAuthService({ repo: createPrismaAccountRepo(prisma) });

  // Email delivery (POWER-AUTOMATE.md sections 2, 4, 5). Notification rows are written inside each transaction;
  // once it commits, a delivery pass is kicked off in the background, and the sweep retries what stayed pending.
  const flowsConfigured = Boolean(urlsFromEnv().notify);
  if (!flowsConfigured) {
    console.warn('PA_NOTIFY_URL is not set: notification emails are skipped (the in-app inbox still works).');
  }
  // A cursor moves each pass past rows that stayed pending, so a few stuck rows cannot starve newer ones; at the
  // end of the queue it wraps to the start, so the stuck rows are still retried.
  let cursor = 0;
  // One helper and one cooldown memory for the life of the process: a row the flow did not answer for waits
  // (1 minute, doubling, at most 30) instead of being emailed again on every sweep.
  const send = createSendToPowerAutomate({ urls: urlsFromEnv });
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

  // File storage is optional in development (everything but proof files keeps working) and required in production.
  const filesBucket = filesBucketFromEnv();
  const bucketConfigured = Boolean(filesBucket && process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID);
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
  const templatesConfigured = Boolean(templatesBucket && process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID);
  if (!templatesConfigured) console.warn('STORAGE_BUCKET_TEMPLATES is not set: sanction template files are disabled.');
  const templateStorage =
    templatesConfigured && templatesBucket
      ? createS3Storage(templatesBucket)
      : createUnavailableStorage('set STORAGE_BUCKET_TEMPLATES and the AWS_* keys');

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
      trustProxy: trustProxyFromEnv(process.env.TRUST_PROXY),
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
      notifications: { inbox: createPrismaInboxStore(prisma) },
    },
  });
  return { app, scheduler };
}

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
