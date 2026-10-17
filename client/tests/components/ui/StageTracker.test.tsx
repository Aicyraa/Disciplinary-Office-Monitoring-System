import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { StageTracker } from '@/components/ui/StageTracker';

test('stage labels shrink and wrap with breathing room at narrow widths', () => {
  const html = renderToStaticMarkup(
    createElement(StageTracker, { steps: ['Reported', 'Validated', 'Sanctioned', 'Resolved'], current: 1, label: 'Case stage' }),
  );
  expect(html).toContain('text-[11px]');
  expect(html).toContain('break-words');
  expect(html).toContain('px-1');
  expect(html).toContain('min-w-0');
  expect(html).toContain('aria-current="step"');
});
