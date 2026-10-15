import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { Chip } from '@/components/ui/Chip';
import { ChipGroup } from '@/components/ui/ChipGroup';
import { ClassTile } from '@/components/ui/ClassTile';
import { Pager } from '@/components/ui/Pager';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { StatTile } from '@/components/ui/StatTile';

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

const OPTIONS = [
  { value: 'all', label: 'All', count: 6 },
  { value: 'minor', label: 'Minor', count: 4 },
  { value: 'major', label: 'Major' },
];

test('Chip selected is filled primary, otherwise white with a border', () => {
  const on = html(createElement(Chip, { selected: true }, 'Minor'));
  expect(on).toContain('bg-primary');
  expect(on).toContain('text-white');
  expect(on).toContain('aria-pressed="true"');
  const off = html(createElement(Chip, { selected: false }, 'Minor'));
  expect(off).toContain('border-line-strong');
  expect(off).toContain('aria-pressed="false"');
});

test('Chip shows an optional count bubble', () => {
  expect(html(createElement(Chip, { selected: false, count: 7 }, 'All'))).toContain('>7<');
});

test('ChipGroup is a tablist of tabs with the selected one marked', () => {
  const out = html(
    createElement(ChipGroup, { label: 'Class', options: OPTIONS, value: 'minor', onChange: () => undefined }),
  );
  expect(out).toContain('role="tablist"');
  expect(out).toContain('aria-label="Class"');
  expect(out.match(/role="tab"/g)).toHaveLength(3);
  expect(out.match(/aria-selected="true"/g)).toHaveLength(1);
});

test('ChipGroup uses a roving tabindex so Tab enters the group once', () => {
  const out = html(
    createElement(ChipGroup, { label: 'Class', options: OPTIONS, value: 'minor', onChange: () => undefined }),
  );
  expect(out.match(/tabindex="0"/g)).toHaveLength(1);
  expect(out.match(/tabindex="-1"/g)).toHaveLength(2);
});

test('SegmentedTabs renders a track with counts and the selected tab raised', () => {
  const out = html(
    createElement(SegmentedTabs, {
      label: 'Appointments',
      options: [
        { value: 'upcoming', label: 'Upcoming', count: 1 },
        { value: 'history', label: 'History', count: 0 },
      ],
      value: 'upcoming',
      onChange: () => undefined,
    }),
  );
  expect(out).toContain('role="tablist"');
  expect(out).toContain('bg-line-soft');
  expect(out).toContain('rounded-full');
  expect(out).toContain('aria-selected="true"');
  expect(out).toContain('bg-white');
  expect(out).toContain('>1<');
});

test('StatTile shows value and label; danger tone turns the value red', () => {
  const out = html(createElement(StatTile, { label: 'Overdue', value: 3, tone: 'danger' }));
  expect(out).toContain('bg-surface-2');
  expect(out).toContain('>3<');
  expect(out).toContain('Overdue');
  expect(out).toContain('text-bad-ink');
  expect(html(createElement(StatTile, { label: 'Open', value: 0 }))).not.toContain('text-bad-ink');
});

test('ClassTile is a toggle button with a class colour', () => {
  const on = html(createElement(ClassTile, { label: 'Major offenses', value: 2, tone: 'major', selected: true }));
  expect(on).toContain('<button');
  expect(on).toContain('aria-pressed="true"');
  expect(on).toContain('border-primary');
  expect(on).toContain('text-bad-ink');
  const off = html(createElement(ClassTile, { label: 'Minor offenses', value: 5, tone: 'minor', selected: false }));
  expect(off).toContain('aria-pressed="false"');
  expect(off).toContain('text-info-ink');
});

test('Pager renders nothing when everything fits on one page', () => {
  expect(html(createElement(Pager, { page: 1, pageCount: 1, onChange: () => undefined }))).toBe('');
});

test('Pager marks the current page and disables prev on the first page', () => {
  const out = html(createElement(Pager, { page: 1, pageCount: 3, onChange: () => undefined }));
  expect(out).toContain('aria-current="page"');
  expect(out).toContain('aria-label="Previous page"');
  expect(out).toContain('aria-label="Next page"');
  expect(out).toMatch(/aria-label="Previous page"[^>]*disabled=""|disabled=""[^>]*aria-label="Previous page"/);
  expect(out).toContain('aria-label="Page 2"');
});

test('Pager disables next on the last page', () => {
  const out = html(createElement(Pager, { page: 3, pageCount: 3, onChange: () => undefined }));
  expect(out).toMatch(/aria-label="Next page"[^>]*disabled=""|disabled=""[^>]*aria-label="Next page"/);
});
