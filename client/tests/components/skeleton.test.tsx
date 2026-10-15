import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { Skeleton, SkeletonList, SkeletonPanel } from '@/components/feedback/Skeleton';

describe('skeleton loading states', () => {
  test('a block is decorative, grey and pulses unless motion is reduced', () => {
    const html = renderToStaticMarkup(<Skeleton className="h-4" />);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('bg-skeleton');
    expect(html).toContain('motion-safe:animate-pulse');
  });

  test('a list announces its label once and draws one placeholder per row, with no spinner', () => {
    const html = renderToStaticMarkup(<SkeletonList label="Loading cases…" rows={3} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html.match(/Loading cases…/g)).toHaveLength(1);
    // Each row is an avatar circle plus two text lines.
    expect(html.match(/bg-skeleton/g)).toHaveLength(9);
    expect(html).not.toContain('animate-spin');
  });

  test('a panel announces its label and draws a title line plus the requested text lines', () => {
    const html = renderToStaticMarkup(<SkeletonPanel label="Loading case…" lines={3} />);
    expect(html).toContain('Loading case…');
    expect(html.match(/bg-skeleton/g)).toHaveLength(4);
  });
});
