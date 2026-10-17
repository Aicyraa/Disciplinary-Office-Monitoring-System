import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { PageHeader } from '@/components/ui';
import { AuthProvider } from '@/context/AuthContext';

const render = (node: ReactNode, path = '/sanctions/11') =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>{node}</AuthProvider>
    </MemoryRouter>,
  );

describe('MasterDetail v3 (side by side on wide screens, list then record screen on narrow ones)', () => {
  test('side by side from 800 px of content, with the screen’s proportions and equal-height panes', () => {
    const html = render(<MasterDetail ratio="cases" list={<p>list</p>} detail={<p>detail</p>} />);
    expect(html).toContain('@container');
    expect(html).toContain('@min-[800px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]');
    expect(html).toContain('@min-[800px]:h-[var(--page-h)]');
    expect(html).toContain('overflow-y-auto');
  });

  test('narrow with a record open: the list hides and a back bar to the list sits above the record', () => {
    const html = render(<MasterDetail ratio="students" list={<p>list</p>} detail={<p>detail</p>} />);
    expect(html).toMatch(/class="[^"]*hidden @min-\[800px\]:block[^"]*"><p>list<\/p>/);
    expect(html).toContain('>detail<');
    // The back bar names the list page and disappears once the panes sit side by side.
    expect(html).toMatch(/<button type="button" class="[^"]*@min-\[800px\]:hidden[^"]*">.*My Sanctions<\/button>/);
  });

  test('a custom back label is used when given', () => {
    const html = render(<MasterDetail list={<p>list</p>} detail={<p>detail</p>} backLabel="All notices" />);
    expect(html).toContain('All notices');
  });

  test('nothing selected: the list shows, and the empty pane shows only beside it', () => {
    const html = render(<MasterDetail list={<p>list</p>} detail={null} emptyDetail={<p>pick one</p>} />, '/sanctions');
    expect(html).toMatch(/<div class="min-w-0 [^"]*"><p>list<\/p>/);
    expect(html).toMatch(/class="[^"]*hidden[^"]*@min-\[800px\]:block[^"]*"[^>]*><p>pick one<\/p>/);
    expect(html).not.toContain('<button');
  });
});

describe('PageHeader: the breadcrumb is the title (deck)', () => {
  test('the heading stays for screen readers, the visible title and subtitle are gone, actions stay', () => {
    const html = renderToStaticMarkup(<PageHeader title="Cases" subtitle="Every case." actions={<button type="button">Do</button>} />);
    expect(html).toMatch(/<h1 class="sr-only">Cases<\/h1>/);
    expect(html).not.toContain('Every case.');
    expect(html).toContain('>Do<');
  });

  test('visible on the screens outside the app frame', () => {
    const html = renderToStaticMarkup(<PageHeader title="Change your password" visible />);
    expect(html).not.toContain('sr-only');
  });
});
