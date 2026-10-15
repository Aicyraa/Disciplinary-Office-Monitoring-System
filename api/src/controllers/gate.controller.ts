import type { RequestHandler } from 'express';
import { signFormToken } from '../domain/gate/token.js';
import { PUBLIC_REJECTION, sendError, sendOk } from '../helpers/http.js';
import type { GateService } from '../services/gate.service.js';
import type { GateOptionsReader } from '../repositories/gate/types.js';
import { parseGateReportBody } from '../validators/gate.validators.js';

/** The one answer for every refusal of a report, so a bot learns nothing about which check failed. */
const GENERIC_REJECTION = PUBLIC_REJECTION;

export interface GateControllerDeps {
  service: GateService;
  options: GateOptionsReader;
  /** HMAC key for the form-timing token (the same SESSION_SECRET the sessions use). */
  secret: string;
  now: () => Date;
}

/** Public gate form handlers (SPEC 4.10, decision 12): no session; protection is applied by the router's middlewares. */
export function createGateController({ service, options, secret, now }: GateControllerDeps) {
  const token: RequestHandler = (_request, response) => {
    sendOk(response, { token: signFormToken(secret, now().getTime()) });
  };

  const formOptions: RequestHandler = async (_request, response) => {
    sendOk(response, await options.listOptions());
  };

  const submit: RequestHandler = async (request, response) => {
    const parsed = parseGateReportBody(request.body);
    if (!parsed.ok) return sendError(response, 400, 'invalid_input', GENERIC_REJECTION);
    const result = await service.submit(parsed.value);
    if (!result.ok) return sendError(response, 400, 'invalid_input', GENERIC_REJECTION);
    sendOk(
      response,
      { reference: result.reference, code: result.code, duplicate: result.duplicate, submittedAt: result.submittedAt },
      result.duplicate ? 200 : 201,
    );
  };

  return { token, formOptions, submit };
}
