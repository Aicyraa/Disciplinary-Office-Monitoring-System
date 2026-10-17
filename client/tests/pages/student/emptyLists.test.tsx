import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { HandbookTable } from '@/pages/student/handbook/HandbookTable';
import { SanctionTable } from '@/pages/student/sanctions/SanctionTable';
import { ViolationTable } from '@/pages/student/violations/ViolationTable';

const inRouter = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('an empty student list says one thing, once', () => {
  test('sanctions: the table gives the message the page chooses', () => {
    expect(inRouter(<SanctionTable rows={[]} selectedId={null} />)).toContain('No sanctions with this status.');
    const none = inRouter(<SanctionTable rows={[]} selectedId={null} emptyText="You have no sanctions." />);
    expect(none).toContain('You have no sanctions.');
    expect(none).not.toContain('No sanctions with this status.');
  });

  test('violations: the table gives the message the page chooses', () => {
    const props = { rows: [], page: 1, onPage: () => undefined, selectedId: null, resolvedCount: 0, showResolved: false, onToggleResolved: () => undefined };
    expect(inRouter(<ViolationTable {...props} />)).toContain('No violations match these filters.');
    expect(inRouter(<ViolationTable {...props} emptyText="You have no violations on record." />)).toContain('You have no violations on record.');
  });

  test('handbook: a search with no match shows its one message in the list', () => {
    const html = inRouter(<HandbookTable rows={[]} query="zzz" onQuery={() => undefined} page={1} onPage={() => undefined} selectedId={null} />);
    expect(html).toContain('No handbook entry matches your search.');
    expect(html).not.toContain('No handbook entry selected.');
  });
});
