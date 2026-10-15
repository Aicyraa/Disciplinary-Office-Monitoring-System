import type { RequestHandler } from 'express';
import type { ClearanceTermSetupResponse } from '@shared/types.js';
import { sendError, sendFailure, sendOk } from '../helpers/http.js';
import { SYSTEM_EMPLOYEE_ID } from '../domain/clearance/rules.js';
import { currentTerm } from '../domain/clearance/term.js';
import type { ClearanceService } from '../services/clearance.service.js';
import { parseTermSetupBody } from '../validators/clearance.validators.js';
import { CLEARANCE_HTTP_STATUS } from './clearance.controller.js';

/** The automatic term set-up, called by the Power Automate schedule. It always acts as the SYSTEM account. */
export function createClearanceJobController({ service, now }: { service: ClearanceService; now: () => Date }) {
  const termSetup: RequestHandler = async (request, response) => {
    const input = parseTermSetupBody(request.body);
    if (!input.ok) return sendError(response, 400, 'invalid_input', input.message);
    const term = input.value ?? currentTerm(now());
    const result = await service.setUpTerm({ employeeId: SYSTEM_EMPLOYEE_ID, ...term });
    if (!result.ok) return sendFailure(response, result, CLEARANCE_HTTP_STATUS);
    const body: ClearanceTermSetupResponse = {
      term: { academicYear: term.academicYear as number, semester: term.semester as number },
      activeStudents: result.activeStudents,
      created: result.created,
      skipped: result.skipped,
    };
    sendOk(response, body);
  };
  return { termSetup };
}
