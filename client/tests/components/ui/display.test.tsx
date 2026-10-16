import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ActionFooter } from '@/components/ui/ActionFooter';
import { DetailTable } from '@/components/ui/DetailTable';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { FileRow } from '@/components/ui/FileRow';
import { GroupHead } from '@/components/ui/GroupHead';
import { HistoryList } from '@/components/ui/HistoryList';
import { ListCard } from '@/components/ui/ListCard';
import { Pill } from '@/components/ui/Pill';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { SelectableRow } from '@/components/ui/SelectableRow';
import { Tag } from '@/components/ui/Tag';

const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element);

test('Pill tones use the named tokens', () => {
  expect(html(createElement(Pill, { tone: 'bad', children: 'Major' }))).toContain('bg-bad-soft');
  expect(html(createElement(Pill, { tone: 'bad', children: 'Major' }))).toContain('text-bad-ink');
  expect(html(createElement(Pill, { tone: 'info', children: 'Minor' }))).toContain('bg-info-soft');
  expect(html(createElement(Pill, { tone: 'pending', children: 'Pending' }))).toContain('bg-pending-soft');
  expect(html(createElement(Pill, { tone: 'done', children: 'Resolved' }))).toContain('bg-success-soft');
  expect(html(createElement(Pill, { tone: 'neutral', children: 'Cancelled' }))).toContain('bg-neutral-soft');
  expect(html(createElement(Pill, { tone: 'action', children: 'Escalated' }))).toContain('bg-amber-soft');
});

test('Tag is the amber label', () => {
  expect(html(createElement(Tag, null, 'Escalated'))).toContain('bg-amber-soft');
});

test('ListCard is a bordered rounded card', () => {
  const out = html(createElement(ListCard, null, 'rows'));
  expect(out).toContain('rounded-xl');
  expect(out).toContain('border-line');
});

test('GroupHead shows a coloured dot, an uppercase label and the count', () => {
  const out = html(createElement(GroupHead, { tone: 'bad', label: 'Needs review', count: 6 }));
  expect(out).toContain('bg-surface-2');
  expect(out).toContain('uppercase');
  expect(out).toContain('Needs review');
  expect(out).toContain('>6<');
});

test('SelectableRow marks the selected row for assistive tech and with the left bar', () => {
  const on = html(createElement(SelectableRow, { selected: true, onSelect: () => undefined }, 'Row'));
  expect(on).toContain('aria-current="true"');
  expect(on).toContain('bg-row-selected');
  const off = html(createElement(SelectableRow, { selected: false, onSelect: () => undefined }, 'Row'));
  expect(off).not.toContain('aria-current');
  expect(off).toContain('hover:bg-row-hover');
});

test('DetailTable renders label and value rows and full-width rows', () => {
  const out = html(
    createElement(DetailTable, {
      rows: [
        { label: 'Case ID', value: 'SDO-2026-016' },
        { label: 'Remarks', value: 'Report to the SDO office.', full: true },
      ],
    }),
  );
  expect(out).toContain('<dl');
  expect(out).toContain('Case ID');
  expect(out).toContain('SDO-2026-016');
  expect(out).toContain('Remarks');
  expect(out).not.toContain('uppercase');
});

test('HistoryList shows date, sentence and the actor', () => {
  const out = html(
    createElement(HistoryList, {
      items: [{ id: 1, date: 'Oct 9, 2026', text: 'Report GI-1042 validated.', by: 'Officer Reyes' }],
    }),
  );
  expect(out).toContain('<ol');
  expect(out).toContain('Oct 9, 2026');
  expect(out).toContain('Report GI-1042 validated.');
  expect(out).toContain('by Officer Reyes');
});

test('FileRow shows the PDF tile, meta and its three actions with hover and pointer rules (4.2b)', () => {
  const out = html(
    createElement(FileRow, {
      name: 'service-log.pdf',
      meta: 'PDF · 242 KB · Uploaded Oct 7, 2:28 PM',
      onView: () => undefined,
      onReplace: () => undefined,
      onRemove: () => undefined,
    }),
  );
  expect(out).toContain('picture_as_pdf');
  expect(out).toContain('service-log.pdf');
  expect(out).toContain('PDF · 242 KB · Uploaded Oct 7, 2:28 PM');
  expect(out).toContain('>View<');
  expect(out).toContain('>Replace<');
  expect(out).toContain('aria-label="Remove service-log.pdf"');
  expect(out).toContain('hover:bg-primary-tint');
  expect(out).toContain('hover:bg-page');
  expect(out).toContain('hover:bg-danger-soft');
  expect(out).toContain('hover:text-danger');
  expect(out).toContain('cursor-pointer');
  expect(out).not.toContain('target="_blank"');
});

test('FileRow shows the Viewed chip only when staff have opened the file', () => {
  const base = { name: 'a.pdf', meta: 'PDF', onView: () => undefined };
  expect(html(createElement(FileRow, { ...base, viewed: true }))).toContain('Viewed');
  expect(html(createElement(FileRow, base))).not.toContain('Viewed');
});

test('FileRow leaves out actions it was not given', () => {
  const out = html(createElement(FileRow, { name: 'a.pdf', meta: 'PDF', onView: () => undefined }));
  expect(out).not.toContain('Replace');
  expect(out).not.toContain('Remove a.pdf');
});

test('SectionLabel numbers and uppercases', () => {
  const out = html(createElement(SectionLabel, { index: 1, children: 'Student' }));
  expect(out).toContain('1 · Student');
  expect(out).toContain('uppercase');
});

test('EmptyBlock shows an icon, a title and the text', () => {
  const out = html(createElement(EmptyBlock, { icon: 'search_off', title: 'No cases in this queue' }, 'Try another filter.'));
  expect(out).toContain('>search_off<');
  expect(out).toContain('No cases in this queue');
  expect(out).toContain('Try another filter.');
});

test('ActionFooter is the full-bleed band at the bottom of a card', () => {
  const out = html(createElement(ActionFooter, null, 'buttons'));
  expect(out).toContain('bg-surface-2');
  expect(out).toContain('border-t');
});
