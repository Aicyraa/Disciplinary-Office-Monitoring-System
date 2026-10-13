import { describe, expect, test } from 'vitest';
import type { HandbookEntryView, SanctionTemplateView } from '@shared/types';
import { categoryMeta, filterTemplatesBy, sanctionCategories, templateFilters, templateState, templateToasts } from '@/utils/templates';

const file = { id: 1, name: 'slip.pdf', mimeType: 'application/pdf', sizeBytes: 10, dateUploaded: '2026-10-09T02:00:00Z' };
const tpl = (sanctionId: number, over: Partial<SanctionTemplateView> = {}): SanctionTemplateView =>
  ({ sanctionId, sanctionCode: `S-00${sanctionId}`, type: `Sanction ${sanctionId}`, title: null, description: null, requirements: null, files: [], ...over }) as SanctionTemplateView;
const entry = (severity: 'Minor' | 'Major', ids: number[]) =>
  ({ severity, sanctions: ids.map((sanctionId) => ({ offenseNumber: 1, sanctionId })) }) as unknown as HandbookEntryView;

describe('sanction templates (deck W47 to W49, src 3130 to 3156)', () => {
  test('row state: file, requirements only, or nothing', () => {
    expect(templateState(tpl(1, { files: [file], requirements: 'Bring it.' }))).toEqual({ text: 'Template posted · with requirements', icon: 'task', tone: 'done', posted: true });
    expect(templateState(tpl(1, { files: [file] })).text).toBe('Template posted');
    expect(templateState(tpl(1, { requirements: 'Bring it.' }))).toMatchObject({ text: 'Requirements only', icon: 'checklist', tone: 'info' });
    expect(templateState(tpl(1, { title: 'Only a title' }))).toMatchObject({ text: 'Nothing posted yet', icon: 'draft', posted: false });
  });

  test('categories come from the violations that list the sanction', () => {
    const entries = [entry('Minor', [1, 2]), entry('Major', [2, 3])];
    expect(sanctionCategories(1, entries)).toEqual(['Minor']);
    expect(sanctionCategories(2, entries)).toEqual(['Minor', 'Major']);
    expect(sanctionCategories(9, entries)).toEqual([]);
    expect(categoryMeta(['Minor'])).toBe('Minor offense sanction');
    expect(categoryMeta(['Minor', 'Major'])).toBe('Minor and major offense sanction');
    expect(categoryMeta([])).toBe('Not listed for any violation yet');
  });

  test('chips with counts: All, Minor, Major, Posted, Not posted', () => {
    const entries = [entry('Minor', [1]), entry('Major', [2])];
    const list = [tpl(1, { files: [file] }), tpl(2), tpl(3, { requirements: 'x' })];
    expect(templateFilters(list, entries).map((f) => [f.value, f.label, f.count])).toEqual([
      ['all', 'All', 3],
      ['Minor', 'Minor', 1],
      ['Major', 'Major', 1],
      ['posted', 'Posted', 2],
      ['missing', 'Not posted', 1],
    ]);
    expect(filterTemplatesBy(list, entries, 'missing').map((t) => t.sanctionId)).toEqual([2]);
    expect(filterTemplatesBy(list, entries, 'Major').map((t) => t.sanctionId)).toEqual([2]);
  });

  test('toasts name the sanction (UI-POLISH-SPEC 6.2)', () => {
    const toasts = templateToasts('Violation slip issued by the SDO');
    expect(toasts.uploaded).toBe('Template uploaded for Violation slip issued by the SDO.');
    expect(toasts.replaced).toBe('Template replaced for Violation slip issued by the SDO.');
    expect(toasts.removed).toBe('Template file removed.');
    expect(toasts.saved).toBe('Saved the template details for Violation slip issued by the SDO.');
  });
});
