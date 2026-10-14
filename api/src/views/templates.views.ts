import type { SanctionTemplateView } from '@shared/types.js';
import { displayCode } from '../domain/codes.js';
import type { TemplateRecord } from '../types/templates.types.js';

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
