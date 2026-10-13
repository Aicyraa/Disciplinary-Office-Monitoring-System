import type { TemplateRecord } from '../../types/templates.types.js';

/** Read side of the templates: every sanction with its template text and file metadata. */
export interface TemplateReader {
  list(): Promise<TemplateRecord[]>;
}
