import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { IconHint } from '@/components/ui/IconHint';
import { proofStatusHint } from '@/utils/studentView';

test('IconHint is a labelled button; the tooltip only appears once opened', () => {
  const html = renderToStaticMarkup(createElement(IconHint, { icon: 'hourglass_top', tone: 'pending', label: 'Pending verification' }));
  expect(html).toContain('<button type="button" aria-label="Pending verification"');
  expect(html).toContain('bg-warn-soft');
  expect(html).not.toContain('role="tooltip"');
});

test.each([
  ['pending_verification', 'hourglass_top', 'pending', /^Pending verification/],
  ['assigned', 'upload', 'info', /^In progress/],
  ['returned', 'undo', 'bad', /^Returned/],
  ['completed', 'check_circle', 'good', /^Verified/],
] as const)('proofStatusHint(%s)', (status, icon, tone, label) => {
  const hint = proofStatusHint(status);
  expect(hint).toMatchObject({ icon, tone });
  expect(hint.label).toMatch(label);
});
