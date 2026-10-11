import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { Pool } from 'pg';
import { app as healthOnlyApp, createApp } from './app.js';
import { createPrismaAccountRepo } from './auth/prisma-repo.js';
import { createAuthService } from './auth/service.js';
import { createPrismaHandbookRepo } from './handbook/prisma-repo.js';
import { createPrismaStudentViewRepo } from './me/prisma-repo.js';
import { createPrismaClient } from './prisma.js';

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

  return createApp({
    auth: { service, sessionSecret: SESSION_SECRET, clientOrigin, sessionStore, secureCookies: isProduction },
    data: { handbook: createPrismaHandbookRepo(prisma), studentViews: createPrismaStudentViewRepo(prisma) },
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
