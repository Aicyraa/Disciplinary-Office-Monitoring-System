import { describe, expect, test } from 'vitest';
import type { HandbookEntryView, SanctionTemplateView } from '@shared/types';
import { filterHandbook, firstSanctionText, handbookTiles, ladder, postedTemplates } from '@/utils/handbook';

const entry = (id: number, over: Partial<HandbookEntryView> = {}): HandbookEntryView =>
  ({
    id,
    code: 'H001',
    violationId: id,
    violationCode: 'V001',
    violation: `Violation ${id}`,
    severity: 'Minor',
    section: `VI.D.${id}`,
    description: 'Text',
    sanctions: [],
    ...over,
  }) as HandbookEntryView;

const san = (offenseNumber: number, sanctionId: number, type: string) => ({ offenseNumber, sanctionId, sanctionCode: `S-00${sanctionId}`, type, description: '' });

describe('Student Handbook (deck W80, W81, src 3087 to 3097)', () => {
  const entries = [
    entry(1, { violation: 'Improper uniform', sanctions: [san(1, 1, 'Violation slip'), san(2, 2, 'Written warning'), san(2, 3, 'Parent conference')] }),
    entry(2, { violation: 'Cheating', severity: 'Major', section: 'VI.E.3', sanctions: [san(1, 4, 'Suspension')] }),
    entry(3, { violation: 'Loitering', sanctions: [] }),
  ];

  test('search matches violation, section or sanction; tiles filter the class', () => {
    expect(filterHandbook(entries, 'warning', 'all').map((e) => e.id)).toEqual([1]);
    expect(filterHandbook(entries, 'vi.e', 'all').map((e) => e.id)).toEqual([2]);
    expect(filterHandbook(entries, '', 'Minor').map((e) => e.id)).toEqual([1, 3]);
    expect(handbookTiles(entries).map((t) => [t.label, t.count])).toEqual([
      ['All offenses', 3],
      ['Minor offenses', 2],
      ['Major offenses', 1],
    ]);
  });

  test('the table names the first offense sanction', () => {
    expect(firstSanctionText(entries[0])).toBe('Violation slip (1st)');
    expect(firstSanctionText(entries[2])).toBe('No sanction listed');
  });

  test('the sanction ladder, one line per offense', () => {
    expect(ladder(entries[0])).toEqual([
      { label: '1st offense', text: 'Violation slip' },
      { label: '2nd offense', text: 'Written warning, Parent conference' },
    ]);
  });

  test('templates posted for the entry: a file or requirements, in ladder order', () => {
    const t = (sanctionId: number, over: Partial<SanctionTemplateView>) => ({ sanctionId, type: `T${sanctionId}`, files: [], requirements: null, ...over }) as SanctionTemplateView;
    const templates = [t(2, { requirements: 'Bring it.' }), t(1, {}), t(3, { files: [{ id: 9, name: 'a.pdf', mimeType: 'application/pdf', sizeBytes: 1, dateUploaded: 'x' }] }), t(4, { requirements: 'x' })];
    expect(postedTemplates(entries[0], templates).map((p) => p.sanctionId)).toEqual([2, 3]);
  });
});
