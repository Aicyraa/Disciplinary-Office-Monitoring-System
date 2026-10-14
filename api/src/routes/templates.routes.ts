import { Router, type NextFunction, type Request, type Response } from 'express';
import multer, { MulterError } from 'multer';
import type { AuthUser, SanctionTemplateView } from '@shared/types.js';
import { requireAuth, requirePasswordChanged, requireStaff } from '../middlewares/auth.js';
import { displayCode } from '../domain/codes.js';
import { MAX_FILE_BYTES } from '../domain/files/validate.js';
import { sendError, sendOk } from '../helpers/http.js';
import type { TemplateReader } from '../repositories/templates/reader.js';
import { FILES_PER_TEMPLATE, type TemplateFailure, type TemplateFailureCode, type TemplateService } from '../services/templates.service.js';
import type { TemplateRecord } from '../types/templates.types.js';
import { parseId } from '../helpers/params.js';

export interface TemplateRouterOptions {
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

const user = (request: Request): AuthUser => request.user as AuthUser;

function sendFailure(response: Response, failure: TemplateFailure): void {
  sendError(response, HTTP_STATUS[failure.code], failure.code, failure.message);
}

/** The public shape: text and file metadata only. Storage keys never leave the server. */
export function toTemplateView(record: TemplateRecord): SanctionTemplateView {
  return {
    sanctionId: record.sanctionId,
    sanctionCode: displayCode('S', record.sanctionId),
    type: record.sanctionType,
    sanctionDescription: record.sanctionDescription,
    title: record.title,
    description: record.description,
    requirements: record.requirements,
    dateUpdated: record.dateUpdated?.toISOString() ?? null,
    files: record.files.map((file) => ({
      id: file.fileId,
      name: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      dateUploaded: file.dateUploaded.toISOString(),
    })),
  };
}

/**
 * Sanction templates (SPEC 4.9, 6.1, 7): staff write the text and upload PDF/DOCX files; any signed-in user
 * reads them and downloads through a short-lived link. Uploads go through Express with memory storage, 10 MB per
 * file; a template holds one file and an upload replaces it; the service re-checks type, size and magic bytes.
 */
export function createTemplateRouter({ service, reader }: TemplateRouterOptions): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_FILE_BYTES, files: FILES_PER_TEMPLATE, fields: 5, parts: 12 },
  });
  const receive = (request: Request, response: Response, next: NextFunction) => {
    upload.array('files', FILES_PER_TEMPLATE)(request, response, (error: unknown) => {
      if (!error) return next();
      let code: TemplateFailureCode = 'invalid_input';
      let message = 'The upload could not be read. Send the files again.';
      if (error instanceof MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          code = 'too_large';
          message = 'A file is larger than 10 MB.';
        } else if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') {
          code = 'too_many_files';
          message = 'A template holds one file. Upload a single file; it replaces the current one.';
        }
      }
      sendError(response, HTTP_STATUS[code], code, message);
    });
  };

  router.get('/sanction-templates', requireAuth, requirePasswordChanged, async (_request, response) => {
    const records = await reader.list();
    sendOk(response, { templates: records.map(toTemplateView) });
  });

  router.get('/sanction-templates/files/:fileId/url', requireAuth, requirePasswordChanged, async (request, response) => {
    const fileId = parseId(request.params.fileId);
    if (fileId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.downloadUrl({ fileId });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { url: result.url, expiresInSeconds: result.expiresInSeconds });
  });

  router.put('/sanction-templates/:sanctionId', ...requireStaff, async (request, response) => {
    const sanctionId = parseId(request.params.sanctionId);
    if (sanctionId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const { title, description, requirements } = request.body ?? {};
    const result = await service.saveText({ employeeId: user(request).id, sanctionId, title, description, requirements });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  router.post('/sanction-templates/:sanctionId/files', ...requireStaff, receive, async (request, response) => {
    const sanctionId = parseId(request.params.sanctionId);
    if (sanctionId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const received = (request.files ?? []) as Express.Multer.File[];
    const result = await service.uploadFiles({
      employeeId: user(request).id,
      sanctionId,
      files: received.map((file) => ({
        name: file.originalname.slice(0, 200),
        mimeType: file.mimetype,
        bytes: new Uint8Array(file.buffer),
      })),
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { fileIds: result.fileIds }, 201);
  });

  router.delete('/sanction-templates/files/:fileId', ...requireStaff, async (request, response) => {
    const fileId = parseId(request.params.fileId);
    if (fileId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.removeFile({ employeeId: user(request).id, fileId });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  return router;
}
