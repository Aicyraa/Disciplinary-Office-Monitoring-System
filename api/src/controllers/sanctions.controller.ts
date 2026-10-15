import type { Request, RequestHandler } from 'express';
import type { AuthUser } from '@shared/types.js';
import { sendError, sendFailure, sendNotFound, sendOk } from '../helpers/http.js';
import { parseId } from '../helpers/params.js';
import { uploadedFiles } from '../middlewares/upload.js';
import { manilaToday } from '../views/me.views.js';
import type { SanctionFailureCode, SanctionService } from '../services/sanctions.service.js';
import { parseProofUploadFields, parseSanctionId } from '../validators/sanctions.validators.js';

export interface SanctionControllerDeps {
  service: SanctionService;
  now: () => Date;
}

const HTTP_STATUS: Record<SanctionFailureCode, number> = {
  invalid_input: 400,
  due_date_in_past: 400,
  unsupported_type: 400,
  empty: 400,
  content_mismatch: 400,
  too_many_files: 400,
  too_large: 413,
  not_found: 404,
  invalid_status: 409,
  sanction_not_allowed: 409,
  already_assigned: 409,
  upload_not_allowed: 409,
  already_reviewed: 409,
  last_file: 409,
  files_not_viewed: 409,
};

const user = (request: Request): AuthUser => request.user as AuthUser;

/**
 * Sanction assignment, proof files and staff verification (SPEC 4.3, 6.1, 7). The service re-checks type,
 * size and magic bytes and enforces every status rule, so the API is the authority whatever the client sends.
 */
export function createSanctionController({ service, now }: SanctionControllerDeps) {
  const options: RequestHandler = async (request, response) => {
    const caseId = parseId(request.params.id);
    if (caseId === null) return sendNotFound(response);
    const result = await service.getAssignmentOptions(caseId);
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { options: result.options });
  };

  const assign: RequestHandler = async (request, response) => {
    const caseId = parseId(request.params.id);
    if (caseId === null) return sendNotFound(response);
    const sanctionId = parseSanctionId(request.body);
    if (!sanctionId.ok) return sendError(response, 400, 'invalid_input', sanctionId.message);
    const result = await service.assignSanction({
      employeeId: user(request).id,
      caseId,
      sanctionId: sanctionId.value,
      dueDate: request.body?.dueDate,
      staffNote: request.body?.staffNote,
      today: manilaToday(now()),
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { caseSanctionId: result.caseSanctionId }, 201);
  };

  const verify: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendNotFound(response);
    const result = await service.verify({ employeeId: user(request).id, caseSanctionId: id });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { ok: true });
  };

  const returnForRevision: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendNotFound(response);
    const result = await service.returnForRevision({
      employeeId: user(request).id,
      caseSanctionId: id,
      reason: request.body?.reason,
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { ok: true });
  };

  const uploadProof: RequestHandler = async (request, response) => {
    const fields = parseProofUploadFields(request.body);
    if (!fields.ok) return sendError(response, 400, 'invalid_input', fields.message);
    const result = await service.uploadProof({
      studentId: user(request).id,
      caseSanctionId: fields.value.caseSanctionId,
      files: uploadedFiles(request),
      replaceCaseSanctionFileId: fields.value.replaceFileId,
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { fileIds: result.caseSanctionFileIds }, 201);
  };

  const removeProof: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendNotFound(response);
    const result = await service.removeProof({ studentId: user(request).id, caseSanctionFileId: id });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, null);
  };

  /** The owning student or any staff member. Opening it as staff marks the file viewed. */
  const fileUrl: RequestHandler = async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) return sendNotFound(response);
    const requester = user(request);
    const result = await service.fileDownloadUrl({
      requester: { role: requester.role, id: requester.id },
      caseSanctionFileId: id,
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    response.set('Cache-Control', 'no-store');
    sendOk(response, { url: result.url, expiresInSeconds: result.expiresInSeconds });
  };

  return { options, assign, verify, returnForRevision, uploadProof, removeProof, fileUrl };
}
