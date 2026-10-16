import type { NextFunction, Request, Response } from 'express';

export interface TimingEntry {
  method: string;
  /** The matched route pattern (`/cases/:id`), so one endpoint's requests group together; the path when none matched. */
  route: string;
  status: number;
  ms: number;
}

/** One log line per request: `GET /cases/:id 200 41.2ms`. */
export function formatTiming({ method, route, status, ms }: TimingEntry): string {
  return `[timing] ${method} ${route} ${status} ${ms.toFixed(1)}ms`;
}

/**
 * Development-only request timing for the performance baseline (PERFORMANCE-SPEC P0 step 2). Never mounted in
 * production (server.ts decides); records nothing about the request body, the user or the query string.
 */
export function requestTiming(record: (entry: TimingEntry) => void, now: () => number = () => performance.now()) {
  return (request: Request, response: Response, next: NextFunction) => {
    const started = now();
    response.on('finish', () => {
      const pattern = request.route?.path;
      record({
        method: request.method,
        route: typeof pattern === 'string' ? `${request.baseUrl}${pattern}` : request.path,
        status: response.statusCode,
        ms: now() - started,
      });
    });
    next();
  };
}
