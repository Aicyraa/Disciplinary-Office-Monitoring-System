import { Router } from 'express';
import type { HandbookEntryView } from '@shared/types.js';
import { displayCode } from '../codes.js';
import { requireAuth, requirePasswordChanged } from '../auth/guards.js';
import { sendError, sendOk } from '../http.js';
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

/** Read-only handbook for any signed-in user (student and staff). Editing is build step 8. */
export function createHandbookRouter({ repo }: { repo: HandbookRepo }): Router {
  const router = Router();
  router.use('/handbook', requireAuth, requirePasswordChanged);

  router.get('/handbook', async (_request, response) => {
    const entries = (await repo.listEntries()).filter(isVisibleInHandbook);
    sendOk(response, { entries: entries.map(toHandbookEntryView) });
  });

  router.get('/handbook/:id', async (request, response) => {
    const id = parseId(String(request.params.id));
    const entry = id === null ? null : await repo.getEntry(id);
    if (!entry || !isVisibleInHandbook(entry)) {
      sendError(response, 404, 'not_found', 'Not found.');
      return;
    }
    sendOk(response, { entry: toHandbookEntryView(entry) });
  });

  return router;
}
