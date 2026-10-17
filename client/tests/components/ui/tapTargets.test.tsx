import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Pager } from '@/components/ui/Pager';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';

// Phone widths get a 44 px floor (min-h-11 / h-11); the compact desktop sizes come back from the rail breakpoint up.
test('shared controls are 44 px tall on a phone and compact from the rail breakpoint', () => {
  expect(renderToStaticMarkup(createElement(Button, { size: 'sm' }, 'Open inbox'))).toContain('min-h-11');
  expect(renderToStaticMarkup(createElement(Button, { size: 'sm' }, 'Open inbox'))).toContain('rail:min-h-[34px]');
  expect(renderToStaticMarkup(createElement(Button, { size: 'md' }, 'Save'))).toContain('min-h-11');
  expect(renderToStaticMarkup(createElement(Chip, { selected: false }, 'All'))).toContain('min-h-11');
  const tabs = renderToStaticMarkup(
    createElement(SegmentedTabs, { label: 'x', value: 'a', onChange: () => undefined, options: [{ value: 'a', label: 'Upcoming' }] }),
  );
  expect(tabs).toContain('min-h-11');
});

test('pager buttons are 44 px tall and shrink in width so seven pages still fit at 320 px', () => {
  const html = renderToStaticMarkup(createElement(Pager, { page: 2, pageCount: 7, onChange: () => undefined }));
  expect(html).toContain('h-11');
  expect(html).toContain('min-w-8');
  expect(html).toContain('flex-1');
});
