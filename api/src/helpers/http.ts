import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
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

/** "Invalid route": nothing matched. Mounted after every router. */
export const notFoundHandler: RequestHandler = (_request, response) => {
  sendError(response, 404, 'route_not_found', 'There is no such route.');
};

/** The one message the public gate form gives for every refusal (see gate/routes.ts). */
export const PUBLIC_REJECTION = 'We could not accept this report. Please check the form and try again.';

interface BodyParserError {
  type?: string;
  status?: number;
  statusCode?: number;
}

/**
 * "Route errors": anything thrown or passed to `next(error)`. Mounted last. Known client faults get their own
 * status and a plain message; everything else is logged here and answered with a generic 500, so a stack
 * trace, SQL or an internal message never reaches the browser.
 */
export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
  // The response is already partly sent: hand it to Express's default handler, which closes the connection.
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    sendError(response, error.status, error.code, error.message);
    return;
  }

  const parserError = (typeof error === 'object' && error !== null ? error : {}) as BodyParserError;
  // The public gate form answers every refusal the same way, including a body that is not JSON or is too big,
  // so a bot cannot tell a parse failure from a failed check.
  if (
    request.path.startsWith('/public/') &&
    (parserError.type === 'entity.parse.failed' || parserError.type === 'entity.too.large')
  ) {
    sendError(response, 400, 'invalid_input', PUBLIC_REJECTION);
    return;
  }
  if (parserError.type === 'entity.parse.failed') {
    sendError(response, 400, 'invalid_json', 'The request body is not valid JSON.');
    return;
  }
  if (parserError.type === 'entity.too.large') {
    sendError(response, 413, 'payload_too_large', 'The request body is too large.');
    return;
  }
  // A malformed percent-encoded path (for example /staff/students/%E0%A4%A/reset-password): the router throws
  // a URIError. That is the client's fault, not the server's.
  if (error instanceof URIError) {
    sendError(response, 400, 'invalid_input', 'The address of the request is not valid.');
    return;
  }
  // Any other error that carries a 4xx status (body-parser faults such as an unsupported charset or an aborted
  // request, or an http-errors 4xx) is the client's problem too.
  const status = parserError.status ?? parserError.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    if (status === 404) sendError(response, 404, 'route_not_found', 'There is no such route.');
    else sendError(response, status, 'invalid_input', 'The request could not be read.');
    return;
  }

  console.error(`Unhandled error on ${request.method} ${request.path}`, error);
  sendError(response, 500, 'internal_error', 'Something went wrong on the server. Please try again.');
};
