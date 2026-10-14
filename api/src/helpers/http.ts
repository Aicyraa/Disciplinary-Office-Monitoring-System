import type { Response } from 'express';
import type { ApiErrorCode, ApiFailure, ApiSuccess } from '@shared/types.js';

/**
 * The one place API responses are built. Every JSON body is an ApiSuccess or an ApiFailure from
 * shared/types.ts (GET /health is the documented exception). Routes never write their own error shapes.
 */
export function sendOk<T>(response: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { ok: true, data };
  response.status(status).json(body);
}

export function sendError(response: Response, status: number, code: ApiErrorCode, message: string): void {
  const body: ApiFailure = { ok: false, error: { code, message } };
  response.status(status).json(body);
}

/** Throw (or `next(new HttpError(...))`) from any handler to answer with that status, code and message. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

/** The one message the public gate form gives for every refusal (see gate/routes.ts). */
export const PUBLIC_REJECTION = 'We could not accept this report. Please check the form and try again.';
