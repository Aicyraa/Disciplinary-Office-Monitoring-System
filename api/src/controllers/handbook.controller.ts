import type { Request, RequestHandler } from 'express';
import type { AuthUser } from '@shared/types.js';
import { sendFailure, sendNotFound, sendOk } from '../helpers/http.js';
import { parseId } from '../helpers/params.js';
import type { HandbookRepo } from '../repositories/handbook/repo.js';
import type { HandbookAdminFailureCode, HandbookAdminService } from '../services/handbook-admin.service.js';
import { isVisibleInHandbook, toHandbookEntryView } from '../views/handbook.views.js';

const ADMIN_STATUS: Record<HandbookAdminFailureCode, number> = {
  invalid_input: 400,
  not_found: 404,
  violation_exists: 409,
  violation_in_use: 409,
};

const isStaff = (request: Request): boolean => (request.user as AuthUser | undefined)?.role === 'staff';

/**
 * The handbook (SPEC 4.9). Any signed-in user reads it; staff also receive "used in N cases" and can create
 * and edit violations. Editing never deletes anything: a violation is keyed by id, so renaming keeps cases intact.
 */
export function createHandbookController({ repo, admin }: { repo: HandbookRepo; admin?: HandbookAdminService }) {
  const list: RequestHandler = async (request, response) => {
    const entries = (await repo.listEntries()).filter(isVisibleInHandbook);
    const views = entries.map(toHandbookEntryView);
    if (isStaff(request)) {
      const counts = await repo.caseCounts();
      for (const view of views) view.usedInCases = counts.get(view.id) ?? 0;
    }
    sendOk(response, { entries: views });
  };

  const detail: RequestHandler = async (request, response) => {
    const id = parseId(String(request.params.id));
    const entry = id === null ? null : await repo.getEntry(id);
    if (!entry || !isVisibleInHandbook(entry)) return sendNotFound(response);
    const view = toHandbookEntryView(entry);
    if (isStaff(request)) view.usedInCases = (await repo.caseCounts()).get(view.id) ?? 0;
    sendOk(response, { entry: view });
  };

  /** Only these five fields are read. The system flag and the ids can never be set from a request. */
  const create: RequestHandler = async (request, response) => {
    if (!admin) return sendNotFound(response);
    const { violationType, severity, section, description, sanctions } = request.body ?? {};
    const result = await admin.create({ violationType, severity, section, description, sanctions });
    if (!result.ok) return sendFailure(response, result, ADMIN_STATUS);
    sendOk(response, { handbookEntryId: result.handbookEntryId }, 201);
  };

  const update: RequestHandler = async (request, response) => {
    if (!admin) return sendNotFound(response);
    const id = parseId(String(request.params.id));
    if (id === null) return sendNotFound(response);
    const { violationType, severity, section, description, sanctions } = request.body ?? {};
    const result = await admin.update({ handbookEntryId: id, violationType, severity, section, description, sanctions });
    if (!result.ok) return sendFailure(response, result, ADMIN_STATUS);
    sendOk(response, { ok: true });
  };

  return { list, detail, create, update };
}
