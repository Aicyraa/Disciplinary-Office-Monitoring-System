import type { Request, RequestHandler } from 'express';
import multer, { MulterError } from 'multer';
import { MAX_FILE_BYTES } from '../domain/files/validate.js';
import { sendError } from '../helpers/http.js';

export interface UploadedFile {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

/**
 * Multipart `files` field into memory (SPEC 6.1): 10 MB per file, UTF-8 file names. Anything the parser
 * rejects is the client's problem, never a 500. The service re-checks type, size and magic bytes.
 */
export function createUploadReceiver({ maxFiles, tooManyMessage }: { maxFiles: number; tooManyMessage: string }): RequestHandler {
  const upload = multer({
    storage: multer.memoryStorage(),
    // File names are UTF-8 (the default is latin1, which garbles names such as "résumé.pdf").
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_FILE_BYTES, files: maxFiles, fields: 5, parts: 12 },
  });
  return (request, response, next) => {
    upload.array('files', maxFiles)(request, response, (error: unknown) => {
      if (!error) return next();
      if (error instanceof MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return sendError(response, 413, 'too_large', 'A file is larger than 10 MB.');
        }
        if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT') {
          return sendError(response, 400, 'too_many_files', tooManyMessage);
        }
      }
      sendError(response, 400, 'invalid_input', 'The upload could not be read. Send the files again.');
    });
  };
}

/** The files `createUploadReceiver` put on the request, in the shape the services take. */
export function uploadedFiles(request: Request): UploadedFile[] {
  const received = (request.files ?? []) as Express.Multer.File[];
  return received.map((file) => ({
    name: file.originalname.slice(0, 200),
    mimeType: file.mimetype,
    bytes: new Uint8Array(file.buffer),
  }));
}
