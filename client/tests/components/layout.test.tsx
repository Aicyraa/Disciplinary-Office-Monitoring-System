import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { PageHeader } from '@/components/ui';

describe('MasterDetail v2 (UI-POLISH-SPEC 5.1, D9)', () => {
  test('side by side from 800 px of content, with the screen’s proportions and equal-height panes', () => {
    const html = renderToStaticMarkup(<MasterDetail ratio="cases" list={<p>list</p>} detail={<p>detail</p>} />);
    expect(html).toContain('@container');
    expect(html).toContain('@min-[800px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]');
    expect(html).toContain('@min-[800px]:h-[var(--page-h)]');
    expect(html).toContain('overflow-y-auto');
  });

  test('stacked below 800 px: both panes on one page, no "Back to list" link', () => {
    const html = renderToStaticMarkup(<MasterDetail ratio="students" list={<p>list</p>} detail={<p>detail</p>} />);
    expect(html).toContain('>list<');
    expect(html).toContain('>detail<');
    expect(html).not.toContain('Back');
    expect(html).toContain('@min-[800px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]');
  });

  test('nothing selected: the empty pane shows only beside the list', () => {
    const html = renderToStaticMarkup(<MasterDetail list={<p>list</p>} detail={null} emptyDetail={<p>pick one</p>} />);
    expect(html).toMatch(/class="[^"]*hidden[^"]*@min-\[800px\]:block[^"]*"[^>]*><p>pick one<\/p>/);
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
