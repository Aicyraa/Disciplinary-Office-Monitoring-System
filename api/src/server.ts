import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { Pool } from 'pg';
import { app as healthOnlyApp, createApp } from './app.js';
import { createPrismaAccountRepo } from './auth/prisma-repo.js';
import { createAuthService } from './auth/service.js';
import { createPrismaCaseQueries, createPrismaCaseStore } from './cases/prisma-store.js';
import { createCaseService } from './cases/service.js';
import { createPrismaHandbookRepo } from './handbook/prisma-repo.js';
import { createPrismaStudentViewRepo } from './me/prisma-repo.js';
import { createPrismaClient } from './prisma.js';
import { createSanctionService } from './sanctions/service.js';
import { createS3Storage } from './storage/s3.js';
import { createUnavailableStorage } from './storage/unavailable.js';

const port = Number(process.env.SERVER_PORT ?? process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === 'production';

function buildApp() {
  const { DATABASE_URL, SESSION_SECRET } = process.env;
  const clientOrigin = process.env.APP_BASE_URL ?? `http://localhost:${process.env.CLIENT_PORT ?? 5173}`;

  if (!DATABASE_URL || !SESSION_SECRET) {
    if (isProduction) throw new Error('DATABASE_URL and SESSION_SECRET are required in production');
    console.warn('DATABASE_URL or SESSION_SECRET missing: serving /health only, auth routes are disabled.');
    return healthOnlyApp;
  }
  if (SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');

  const PgStore = connectPgSimple(session);
  const sessionStore = new PgStore({ pool: new Pool({ connectionString: DATABASE_URL }), createTableIfMissing: true });
  const prisma = createPrismaClient();
  const service = createAuthService({ repo: createPrismaAccountRepo(prisma) });
  const caseStore = createPrismaCaseStore(prisma);

  // File storage is optional in development (everything but proof files keeps working) and required in production.
  const bucketConfigured = Boolean(
    process.env.STORAGE_BUCKET && process.env.AWS_ENDPOINT_URL_S3 && process.env.AWS_ACCESS_KEY_ID,
  );
  if (!bucketConfigured && isProduction) throw new Error('STORAGE_BUCKET and the AWS_* variables are required in production');
  if (!bucketConfigured) console.warn('Object storage variables missing: proof file upload and download are disabled.');
  const storage = bucketConfigured ? createS3Storage() : createUnavailableStorage('set STORAGE_BUCKET and the AWS_* keys');

  return createApp({
    auth: { service, sessionSecret: SESSION_SECRET, clientOrigin, sessionStore, secureCookies: isProduction },
    data: {
      handbook: createPrismaHandbookRepo(prisma),
      studentViews: createPrismaStudentViewRepo(prisma),
      cases: {
        service: createCaseService({ store: caseStore }),
        queries: createPrismaCaseQueries(prisma),
      },
      sanctions: { service: createSanctionService({ store: caseStore, storage }) },
    },
  });
}

const server = buildApp().listen(port, () => {
  console.log(`API listening on port ${port}`);
});

server.on('error', (error) => {
  console.error(error);
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
