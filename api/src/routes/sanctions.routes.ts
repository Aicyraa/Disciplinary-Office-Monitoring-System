import { Router, type NextFunction, type Request, type Response } from 'express';
import multer, { MulterError } from 'multer';
import type { AuthUser } from '@shared/types.js';
import { requireAuth, requirePasswordChanged, requireStaff, requireStudent } from '../middleware/auth.js';
import { sendError, sendOk } from '../lib/http.js';
import { MAX_FILE_BYTES, MAX_FILES_PER_SANCTION } from '../domain/files/validate.js';
import { manilaToday } from '../views/me.views.js';
import type { SanctionFailure, SanctionFailureCode, SanctionService } from '../services/sanctions.service.js';
import { parseId } from '../lib/params.js';

export interface SanctionRouterOptions {
  service: SanctionService;
  now?: () => Date;
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

function sendFailure(response: Response, failure: SanctionFailure): void {
  sendError(response, HTTP_STATUS[failure.code], failure.code, failure.message);
}

/**
 * Sanction assignment, proof files and staff verification (SPEC 4.3, 6.1, 7). Uploads go through Express:
 * memory storage, 10 MB per file, one file per request; the service re-checks type, size and magic
 * bytes and enforces every status rule, so the API is the authority no matter what the client sends.
 */
export function createSanctionRouter({ service, now = () => new Date() }: SanctionRouterOptions): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    // File names are UTF-8 (the default is latin1, which garbles names such as "résumé.pdf").
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_SANCTION, fields: 5, parts: 12 },
  });

  // ---- staff: assign ------------------------------------------------------------------------
  router.get('/cases/:id/sanction-options', ...requireStaff, async (request, response) => {
    const caseId = parseId(request.params.id);
    if (caseId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.getAssignmentOptions(caseId);
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { options: result.options });
  });

  router.post('/cases/:id/sanctions', ...requireStaff, async (request, response) => {
    const caseId = parseId(request.params.id);
    if (caseId === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const sanctionId = request.body?.sanctionId;
    if (!Number.isInteger(sanctionId) || sanctionId < 1) {
      sendError(response, 400, 'invalid_input', 'sanctionId is required.');
      return;
    }
    const result = await service.assignSanction({
      employeeId: user(request).id,
      caseId,
      sanctionId,
      dueDate: request.body?.dueDate,
      staffNote: request.body?.staffNote,
      today: manilaToday(now()),
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { caseSanctionId: result.caseSanctionId }, 201);
  });

  // ---- staff: review ------------------------------------------------------------------------

  router.post('/case-sanctions/:id/verify', ...requireStaff, async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.verify({ employeeId: user(request).id, caseSanctionId: id });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  router.post('/case-sanctions/:id/return', ...requireStaff, async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.returnForRevision({ employeeId: user(request).id, caseSanctionId: id, reason: request.body?.reason });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { ok: true });
  });

  // ---- student: proof files ------------------------------------------------------------------
  const receive = (request: Request, response: Response, next: NextFunction) => {
    upload.array('files', MAX_FILES_PER_SANCTION)(request, response, (error: unknown) => {
      if (!error) return next();
      // Everything the multipart parser rejects is the client's problem: never a 500.
      let code: SanctionFailureCode = 'invalid_input';
      let message = 'The upload could not be read. Send the files again.';
      if (error instanceof MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          code = 'too_large';
          message = 'A file is larger than 10 MB.';
        } else if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') {
          code = 'too_many_files';
          message = 'You can upload only one file per sanction.';
        }
      }
      sendError(response, HTTP_STATUS[code], code, message);
    });
  };

  router.post('/files', ...requireStudent, receive, async (request, response) => {
    const caseSanctionId = parseId(request.body?.caseSanctionId);
    const replaceRaw = request.body?.replaceFileId;
    const replaceId = replaceRaw === undefined || replaceRaw === '' ? undefined : parseId(replaceRaw);
    if (caseSanctionId === null || replaceId === null) {
      sendError(response, 400, 'invalid_input', 'caseSanctionId is required.');
      return;
    }
    const received = (request.files ?? []) as Express.Multer.File[];
    const result = await service.uploadProof({
      studentId: user(request).id,
      caseSanctionId,
      files: received.map((file) => ({
        name: file.originalname.slice(0, 200),
        mimeType: file.mimetype,
        bytes: new Uint8Array(file.buffer),
      })),
      replaceCaseSanctionFileId: replaceId,
    });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, { fileIds: result.caseSanctionFileIds }, 201);
  });

  router.delete('/files/:id', ...requireStudent, async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const result = await service.removeProof({ studentId: user(request).id, caseSanctionFileId: id });
    if (!result.ok) return sendFailure(response, result);
    sendOk(response, null);
  });

  // The owning student or any staff member. Opening it as staff marks the file viewed.
  router.get('/files/:id/url', requireAuth, requirePasswordChanged, async (request, response) => {
    const id = parseId(request.params.id);
    if (id === null) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const requester = user(request);
    const result = await service.fileDownloadUrl({
      requester: { role: requester.role, id: requester.id },
      caseSanctionFileId: id,
    });
    if (!result.ok) return sendFailure(response, result);
    response.set('Cache-Control', 'no-store');
    sendOk(response, { url: result.url, expiresInSeconds: result.expiresInSeconds });
  });

  return router;
}
