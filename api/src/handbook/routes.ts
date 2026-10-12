import { Router, type Response } from 'express';
import type { AuthUser, HandbookEntryView } from '@shared/types.js';
import { displayCode } from '../codes.js';
import { requireAuth, requirePasswordChanged, requireStaff } from '../auth/guards.js';
import { sendError, sendOk } from '../http.js';
import type { HandbookAdminFailure, HandbookAdminFailureCode, HandbookAdminService } from './admin-service.js';
import type { HandbookEntryRecord, HandbookRepo } from './repo.js';

export function toHandbookEntryView(record: HandbookEntryRecord): HandbookEntryView {
  return {
    id: record.handbookEntryId,
    code: displayCode('H', record.handbookEntryId),
    violationId: record.violation.violationId,
    violationCode: displayCode('V', record.violation.violationId),
    violation: record.violation.violationType,
    severity: record.violation.severity,
    section: record.handbookSection,
    description: record.violation.description,
    // Ordered here, not in the repository, so every repository yields the same output.
    sanctions: [...record.sanctions]
      .sort((a, b) => a.offenseNumber - b.offenseNumber || a.sanctionId - b.sanctionId)
      .map((sanction) => ({
        offenseNumber: sanction.offenseNumber,
        sanctionId: sanction.sanctionId,
        sanctionCode: displayCode('S', sanction.sanctionId),
        type: sanction.sanctionType,
        description: sanction.description,
      })),
  };
}

/** FEATURE-RULES 3.2: system entries (V068 / H068 "3 minor offense") are hidden from every handbook list. */
export const isVisibleInHandbook = (record: HandbookEntryRecord): boolean => !record.violation.isSystem;

const parseId = (value: string): number | null => (/^\d{1,9}$/.test(value) ? Number(value) : null);

const ADMIN_STATUS: Record<HandbookAdminFailureCode, number> = {
  invalid_input: 400,
  not_found: 404,
  violation_exists: 409,
  violation_in_use: 409,
};

function sendAdminFailure(response: Response, failure: HandbookAdminFailure): void {
  sendError(response, ADMIN_STATUS[failure.code], failure.code, failure.message);
}

/**
 * The handbook. Any signed-in user reads it; staff also receive "used in N cases" and can create and edit
 * violations (SPEC 4.9). Editing never deletes anything: a violation is keyed by id, so renaming keeps cases intact.
 */
export function createHandbookRouter({ repo, admin }: { repo: HandbookRepo; admin?: HandbookAdminService }): Router {
  const router = Router();
  router.use('/handbook', requireAuth, requirePasswordChanged);

  const isStaff = (request: { user?: unknown }): boolean => (request.user as AuthUser | undefined)?.role === 'staff';

  router.get('/handbook', async (request, response) => {
    const entries = (await repo.listEntries()).filter(isVisibleInHandbook);
    const views = entries.map(toHandbookEntryView);
    if (isStaff(request)) {
      const counts = await repo.caseCounts();
      for (const view of views) view.usedInCases = counts.get(view.id) ?? 0;
    }
    sendOk(response, { entries: views });
  });

  router.get('/handbook/:id', async (request, response) => {
    const id = parseId(String(request.params.id));
    const entry = id === null ? null : await repo.getEntry(id);
    if (!entry || !isVisibleInHandbook(entry)) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    const view = toHandbookEntryView(entry);
    if (isStaff(request)) view.usedInCases = (await repo.caseCounts()).get(view.id) ?? 0;
    sendOk(response, { entry: view });
  });

  if (admin) {
    router.post('/handbook', ...requireStaff, async (request, response) => {
      const { violationType, severity, section, description, sanctions } = request.body ?? {};
      const result = await admin.create({ violationType, severity, section, description, sanctions });
      if (!result.ok) return sendAdminFailure(response, result);
      sendOk(response, { handbookEntryId: result.handbookEntryId }, 201);
    });

    router.patch('/handbook/:id', ...requireStaff, async (request, response) => {
      const id = parseId(String(request.params.id));
      if (id === null) {
        sendError(response, 404, 'not_found', 'Not found.');
        return;
      }
      // Only these five fields are read. The system flag and the ids can never be set from a request.
      const { violationType, severity, section, description, sanctions } = request.body ?? {};
      const result = await admin.update({ handbookEntryId: id, violationType, severity, section, description, sanctions });
      if (!result.ok) return sendAdminFailure(response, result);
      sendOk(response, { ok: true });
    });
  }

  return router;
}
