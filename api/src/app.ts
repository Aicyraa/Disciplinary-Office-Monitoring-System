import cors from 'cors';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import type { HealthResponse } from '../../shared/types.js';
import { createAuthRouter, type LoginRateLimitOptions } from './auth/routes.js';
import type { AuthService } from './auth/service.js';

export interface AppDeps {
  /** Omitted in the smoke test: the app then serves only /health and needs no database. */
  auth?: {
    service: AuthService;
    sessionSecret: string;
    /** The one browser origin allowed by CORS (the client). */
    clientOrigin: string;
    /** Defaults to an in-memory store; production passes connect-pg-simple. */
    sessionStore?: session.Store;
    secureCookies?: boolean;
    loginRateLimit?: LoginRateLimitOptions;
  };
}

export function createApp({ auth }: AppDeps = {}) {
  const app = express();

  app.get('/health', (_request, response) => {
    const health: HealthResponse = { status: 'ok' };
    response.status(200).json(health);
  });

  if (auth) {
    app.use(helmet());
    app.use(
      cors({
        // Sends CORS headers only to the client origin; other origins get none.
        origin: (origin, callback) => callback(null, origin === auth.clientOrigin),
        credentials: true,
      }),
    );
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
  }

  return app;
}

export const app = createApp();
