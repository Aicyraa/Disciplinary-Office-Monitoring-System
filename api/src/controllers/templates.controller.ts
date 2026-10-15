import type { RequestHandler } from 'express';
import { sendFailure, sendNotFound, sendOk } from '../helpers/http.js';
import { parseId, sessionUserId } from '../helpers/params.js';
import { uploadedFiles } from '../middlewares/upload.js';
import type { TemplateReader } from '../repositories/templates/reader.js';
import type { TemplateFailureCode, TemplateService } from '../services/templates.service.js';
import { toTemplateView } from '../views/templates.views.js';

export interface TemplateControllerDeps {
  service: TemplateService;
  reader: TemplateReader;
}

const HTTP_STATUS: Record<TemplateFailureCode, number> = {
  invalid_input: 400,
  unsupported_type: 400,
  empty: 400,
  content_mismatch: 400,
  too_many_files: 400,
  too_large: 413,
  not_found: 404,
};

/**
 * Sanction template handlers (SPEC 4.9, 6.1, 7): staff write the text and upload PDF/DOCX files; any
 * signed-in user reads them and downloads through a short-lived link.
 */
export function createTemplateController({ service, reader }: TemplateControllerDeps) {
  const list: RequestHandler = async (_request, response) => {
    const records = await reader.list();
    sendOk(response, { templates: records.map(toTemplateView) });
  };

  const fileUrl: RequestHandler = async (request, response) => {
    const fileId = parseId(request.params.fileId);
    if (fileId === null) return sendNotFound(response);
    const result = await service.downloadUrl({ fileId });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { url: result.url, expiresInSeconds: result.expiresInSeconds });
  };

  const saveText: RequestHandler = async (request, response) => {
    const sanctionId = parseId(request.params.sanctionId);
    if (sanctionId === null) return sendNotFound(response);
    const { title, description, requirements } = request.body ?? {};
    const result = await service.saveText({
      employeeId: sessionUserId(request),
      sanctionId,
      title,
      description,
      requirements,
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { ok: true });
  };

  const uploadFiles: RequestHandler = async (request, response) => {
    const sanctionId = parseId(request.params.sanctionId);
    if (sanctionId === null) return sendNotFound(response);
    const result = await service.uploadFiles({
      employeeId: sessionUserId(request),
      sanctionId,
      files: uploadedFiles(request),
    });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { fileIds: result.fileIds }, 201);
  };

  const removeFile: RequestHandler = async (request, response) => {
    const fileId = parseId(request.params.fileId);
    if (fileId === null) return sendNotFound(response);
    const result = await service.removeFile({ employeeId: sessionUserId(request), fileId });
    if (!result.ok) return sendFailure(response, result, HTTP_STATUS);
    sendOk(response, { ok: true });
  };

  return { list, fileUrl, saveText, uploadFiles, removeFile };
}
