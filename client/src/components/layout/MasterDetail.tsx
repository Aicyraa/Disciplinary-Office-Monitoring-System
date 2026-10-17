import { useEffect, useRef, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';
import { breadcrumb } from '@/utils/nav';

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
  /** Where the phone back bar goes; defaults to the page's own address without the record (`/sanctions/11` -> `/sanctions`). */
  backTo?: string;
  /** The back bar's label; defaults to the page name ("My Sanctions"). */
  backLabel?: string;
  /** For pages that keep the selection in state rather than the URL: what the phone back bar does instead. */
  onBack?: () => void;
  /** Changes when another record is selected, so a phone opens it at the top. */
  detailKey?: string | number | null;
}

/**
 * List and detail (deck src 546). From 800 px of content the two cards sit side by side, as tall as the window
 * minus the header, each scrolling on its own. Narrower (phones, small tablets) it works like a phone app: the
 * list is one screen and a picked record opens as its own screen, with a back bar to the list. The selection
 * lives in the URL, so a record is linkable and the system back gesture returns to the list.
 */
export function MasterDetail({ list, detail, emptyDetail, ratio = 'even', backTo, backLabel, onBack, detailKey }: MasterDetailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstKey = useRef(detailKey);
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = useAuth();
  const role = state.status === 'authenticated' ? state.user.role : 'student';
  const listPath = backTo ?? `/${location.pathname.split('/')[1] ?? ''}${location.search}`;
  const label = backLabel ?? breadcrumb(role, listPath.split('?')[0] ?? '/')[1] ?? 'Back';

  // A record opened on a narrow screen starts at the top, like a new screen.
  useEffect(() => {
    if (detailKey === undefined || detailKey === null || detailKey === firstKey.current) return;
    firstKey.current = detailKey;
    const container = containerRef.current;
    if (container && container.clientWidth < 800 && typeof window.scrollTo === 'function') window.scrollTo({ top: 0 });
  }, [detailKey]);

  const goBack = () => {
    if (onBack) onBack();
    else navigate(listPath, { state: { fromList: true } });
  };

  const pane = 'min-w-0 @min-[800px]:h-[var(--page-h)] @min-[800px]:overflow-y-auto';
  const open = detail !== null;
  return (
    <div ref={containerRef} className="@container">
      <div className={cn('grid gap-6', RATIOS[ratio])}>
        <div className={cn(pane, open && 'hidden @min-[800px]:block')}>{list}</div>
        {open ? (
          <div className={pane}>
            <button
              type="button"
              onClick={goBack}
              className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1 rounded-full pr-3 pl-1 text-[15px] font-semibold text-primary outline-none active:bg-primary-tint focus-visible:ring-[3px] focus-visible:ring-primary/25 @min-[800px]:hidden"
            >
              <Icon name="arrow_back_ios_new" className="!text-xl" />
              {label}
            </button>
            {/* Records that fill their pane (`min-h-full`) measure against this box, not the pane plus the back bar. */}
            <div className="@min-[800px]:h-full">{detail}</div>
          </div>
        ) : emptyDetail ? (
          <div className={cn(pane, 'hidden @min-[800px]:block')}>{emptyDetail}</div>
        ) : null}
      </div>
    </div>
  );
}
