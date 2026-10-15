type Env = Record<string, string | undefined>;

/**
 * The only place environment variables are read (CLAUDE.md section 10). Every function reads at call time so a
 * test or a late-loaded `.env` is honoured. Bucket names live in `config/storage.ts`, the proxy count in
 * `config/gate.ts`.
 */

export interface ServerEnv {
  port: number;
  isProduction: boolean;
  databaseUrl: string | undefined;
  sessionSecret: string | undefined;
  /** APP_BASE_URL: the client origin when it is not the local default. */
  appBaseUrl: string | undefined;
  clientPort: string | undefined;
  /** Raw TRUST_PROXY; parsed by `trustProxyFromEnv`. */
  trustProxy: string | undefined;
}

export function readServerEnv(env: Env = process.env): ServerEnv {
  return {
    port: Number(env.SERVER_PORT ?? env.PORT ?? 3000),
    isProduction: env.NODE_ENV === 'production',
    databaseUrl: env.DATABASE_URL,
    sessionSecret: env.SESSION_SECRET,
    appBaseUrl: env.APP_BASE_URL,
    clientPort: env.CLIENT_PORT,
    trustProxy: env.TRUST_PROXY,
  };
}

/** Power Automate trigger URLs (POWER-AUTOMATE.md). They are the secret; never give them a VITE_ prefix. */
export function flowUrlsFromEnv(env: Env = process.env): { notify?: string; gate?: string } {
  return {
    notify: env.PA_NOTIFY_URL || undefined,
    gate: env.PA_GATE_URL || undefined,
  };
}

/**
 * PA_JOB_KEY: the key Power Automate sends in `X-SDO-Job-Key` to run scheduled jobs (the term clearance set-up).
 * Server only; never give it a VITE_ prefix.
 */
export function jobKeyFromEnv(env: Env = process.env): string | undefined {
  return env.PA_JOB_KEY || undefined;
}

export interface S3Env {
  region: string | undefined;
  endpoint: string | undefined;
  accessKeyId: string | undefined;
  secretAccessKey: string | undefined;
}

export function s3FromEnv(env: Env = process.env): S3Env {
  return {
    region: env.AWS_REGION,
    endpoint: env.AWS_ENDPOINT_URL_S3,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  };
}

/** True when the endpoint and key id are present: the server's "storage is configured" check. */
export function s3Configured(env: Env = process.env): boolean {
  const { endpoint, accessKeyId } = s3FromEnv(env);
  return Boolean(endpoint && accessKeyId);
}

/** A required variable for the S3 client; throws with the variable name so a log points at the gap. */
export function requireEnv(name: string, env: Env = process.env): string {
  const value = env[name];
  if (!value) throw new Error(`${name} must be supplied before creating the S3 storage client`);
  return value;
}
