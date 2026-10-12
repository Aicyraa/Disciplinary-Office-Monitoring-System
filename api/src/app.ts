import cors from 'cors';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import type { HealthResponse } from '@shared/types.js';
import { clientOriginFrom, defaultClientOrigin } from './cors.js';
import { createAuthRouter, type LoginRateLimitOptions } from './auth/routes.js';
import type { AuthService } from './auth/service.js';
import type { CaseQueries } from './cases/queries.js';
import { createCaseRouter } from './cases/routes.js';
import type { CaseService } from './cases/service.js';
import { createHandbookRouter } from './handbook/routes.js';
import type { HandbookRepo } from './handbook/repo.js';
import { errorHandler, notFoundHandler, sendError } from './http.js';
import { createMeRouter } from './me/routes.js';
import { createSanctionRouter } from './sanctions/routes.js';
import type { SanctionService } from './sanctions/service.js';
import type { StudentViewRepo } from './me/repo.js';

export interface AppDeps {
  /** Omitted in the smoke test: the app then serves only /health and needs no database. */
  auth?: {
    service: AuthService;
    sessionSecret: string;
    /** The single browser origin allowed by CORS (the client), for example `http://localhost:5173`. */
    clientOrigin: string;
    /** Defaults to an in-memory store; production passes connect-pg-simple. */
    sessionStore?: session.Store;
    secureCookies?: boolean;
    loginRateLimit?: LoginRateLimitOptions;
  };
  /**
   * Used instead of `auth` when required configuration is missing (development). Every route except /health
   * answers 503 `server_not_configured` with the reason, and CORS headers are sent for the client origin, so
   * the browser shows the real cause instead of a misleading "cannot reach the server".
   */
  unconfigured?: { clientOrigin: string; reason: string };
  /** Read-side repositories. Routes mount only when `auth` is also given (they need the session). */
  data?: {
    handbook: HandbookRepo;
    studentViews: StudentViewRepo;
    /** Staff case workflow: the rules (service) and the read side (queries). */
    cases?: { service: CaseService; queries: CaseQueries };
    /** Sanction assignment, proof files and verification. */
    sanctions?: { service: SanctionService };
    /** Injected so tests control "today" (Asia/Manila). */
    now?: () => Date;
  };
}

/** CORS for exactly one origin; any other origin gets no CORS headers. */
function clientCors(origin: string) {
  return cors({
    origin: (requestOrigin, callback) => callback(null, requestOrigin === origin),
    credentials: true,
  });
}

export function createApp({ auth, data, unconfigured }: AppDeps = {}) {
  const app = express();

  // The one route outside the response envelope: a probe with a documented plain body.
  app.get('/health', (_request, response) => {
    const health: HealthResponse = { status: 'ok' };
    response.status(200).json(health);
  });

  if (!auth && unconfigured) {
    // Serves nothing but a fixed reason (no data, no cookies). If the configured client origin is itself the
    // problem, the default localhost origin is used so the reason is still readable at the usual address.
    const origin = clientOriginFrom(unconfigured.clientOrigin) ?? defaultClientOrigin(undefined);
    app.use(clientCors(origin));
    app.use((_request, response) => {
      sendError(response, 503, 'server_not_configured', unconfigured.reason);
    });
  }

  if (auth) {
    const origin = clientOriginFrom(auth.clientOrigin);
    if (origin === null) throw new Error(`clientOrigin must be an http(s) origin such as http://localhost:5173 (got "${auth.clientOrigin}")`);
    app.use(helmet());
    app.use(clientCors(origin));
    app.use(express.json({ limit: '100kb' }));
    app.use(
      session({
        name: 'sdo.sid',
        secret: auth.sessionSecret,
        store: auth.sessionStore,
        resave: false,
        saveUninitialized: false,
        cookie: {
          httpOnly: true,
          sameSite: 'lax',
          secure: auth.secureCookies ?? false,
          maxAge: 8 * 60 * 60 * 1000,
        },
      }),
    );
    app.use(createAuthRouter({ service: auth.service, loginRateLimit: auth.loginRateLimit }));

    if (data) {
      app.use(createHandbookRouter({ repo: data.handbook }));
      app.use(createMeRouter({ repo: data.studentViews, now: data.now }));
      if (data.cases) app.use(createCaseRouter({ ...data.cases, now: data.now }));
      if (data.sanctions) app.use(createSanctionRouter({ service: data.sanctions.service, now: data.now }));
    }
  }

  // After every router: "invalid route" (404) and "route errors" (thrown or passed to next(error)).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
