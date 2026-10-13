import { describe, expect, test } from 'vitest';
import type { SanctionTemplateView } from '@shared/types';
import { filterTemplates } from './SanctionTemplates';

const template = (sanctionId: number, over: Partial<SanctionTemplateView>): SanctionTemplateView =>
  ({ sanctionId, title: null, description: null, requirements: null, files: [], ...over }) as SanctionTemplateView;

describe('filterTemplates', () => {
  const list = [
    template(1, { files: [{ id: 1, name: 'slip.pdf', mimeType: 'application/pdf', sizeBytes: 10, dateUploaded: '2026-10-09T02:00:00Z' }] }),
    template(2, { requirements: 'Bring a parent.' }),
    template(3, {}),
  ];

  test('all keeps every sanction', () => {
    expect(filterTemplates(list, 'all').map((t) => t.sanctionId)).toEqual([1, 2, 3]);
  });

  test('posted means a file or any written text; not posted is the rest', () => {
    expect(filterTemplates(list, 'posted').map((t) => t.sanctionId)).toEqual([1, 2]);
    expect(filterTemplates(list, 'not_posted').map((t) => t.sanctionId)).toEqual([3]);
  });
});
