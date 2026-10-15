import type { RequestHandler } from 'express';
import type { AuthUser } from '@shared/types.js';
import { sendError, sendFailure, sendOk } from '../helpers/http.js';
import { uploadedAvatar } from '../middlewares/upload.js';
import type { AvatarService } from '../services/avatar.service.js';

/** `/me/avatar`: the signed-in student's or staff member's own profile picture (SPEC 4.8). */
export function createAvatarController({ service }: { service: AvatarService }) {
  const statuses = { unsupported_type: 400, empty: 400, content_mismatch: 400, too_large: 413, not_found: 404 } as const;

  const put: RequestHandler = async (request, response) => {
    const file = uploadedAvatar(request);
    if (!file) return sendError(response, 400, 'invalid_input', 'Choose a picture to upload.');
    const user = request.user as AuthUser;
    const result = await service.set(user.role, user.id, file);
    if (!result.ok) return sendFailure(response, result, statuses);
    sendOk(response, { user: result.user });
  };

  const remove: RequestHandler = async (request, response) => {
    const user = request.user as AuthUser;
    const result = await service.remove(user.role, user.id);
    if (!result.ok) return sendFailure(response, result, statuses);
    sendOk(response, { user: result.user });
  };

  return { put, remove };
}
