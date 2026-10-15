import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/** Pane proportions per screen, from the source (list : detail). */
const RATIOS = {
  cases: '@min-[800px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]',
  appointments: '@min-[800px]:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]',
  students: '@min-[800px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]',
  clearance: '@min-[800px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]',
  handbook: '@min-[800px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]',
  student: '@min-[800px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]',
  notices: '@min-[800px]:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]',
  even: '@min-[800px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
} as const;

export type PaneRatio = keyof typeof RATIOS;

interface MasterDetailProps {
  list: ReactNode;
  /** The right pane. Null when nothing is selected. */
  detail: ReactNode | null;
  /** Shown beside the list while nothing is selected (not when the panes stack). */
  emptyDetail?: ReactNode;
  ratio?: PaneRatio;
  /** Kept for older callers; the stacked layout has no back link. */
  backTo?: string;
  backLabel?: string;
  /** Changes when another record is selected, so a phone scrolls down to it. */
  detailKey?: string | number | null;
}

/**
 * List and detail (deck src 546). From 800 px of content the two cards sit side by side, as tall as the window
 * minus the header, each scrolling on its own. Narrower, they stack on one page: the list, then the record;
 * picking a row scrolls down to the record (D9). The selection lives in the URL, so a record is linkable.
 */
export function MasterDetail({ list, detail, emptyDetail, ratio = 'even', detailKey }: MasterDetailProps) {
  const detailRef = useRef<HTMLDivElement>(null);
  const firstKey = useRef(detailKey);

  useEffect(() => {
    if (detailKey === undefined || detailKey === null || detailKey === firstKey.current) return;
    firstKey.current = detailKey;
    const pane = detailRef.current;
    const container = pane?.parentElement;
    if (pane && container && container.clientWidth < 800) {
      pane.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }, [detailKey]);

  const pane = 'min-w-0 @min-[800px]:h-[var(--page-h)] @min-[800px]:overflow-y-auto';
  return (
    <div className="@container">
      <div className={cn('grid gap-6', RATIOS[ratio])}>
        <div className={pane}>{list}</div>
        {detail !== null ? (
          <div ref={detailRef} className={cn(pane, 'scroll-mt-[76px]')}>
            {detail}
          </div>
        ) : emptyDetail ? (
          <div className={cn(pane, 'hidden @min-[800px]:block')}>{emptyDetail}</div>
        ) : null}
      </div>
    </div>
  );
}
