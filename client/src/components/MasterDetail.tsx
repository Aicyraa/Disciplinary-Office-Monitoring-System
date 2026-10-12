import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui';

interface MasterDetailProps {
  list: ReactNode;
  /** The right pane. Null when nothing is selected. */
  detail: ReactNode | null;
  /** Shown in the right pane on wide screens while nothing is selected. */
  emptyDetail?: ReactNode;
  /** Where the phone "Back to list" link goes (the list route). */
  backTo: string;
  backLabel?: string;
}

/**
 * Two panes (list left, record right) from 720 px up. On a phone one pane shows at a time: the list, or the
 * selected record with a Back link. The selection lives in the URL, so a record is linkable and Back works.
 */
export function MasterDetail({ list, detail, emptyDetail, backTo, backLabel = 'Back to list' }: MasterDetailProps) {
  const hasDetail = detail !== null;
  return (
    <div className="grid gap-4 rail:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
      <div className={hasDetail ? 'hidden rail:block' : ''}>{list}</div>
      <div className={hasDetail ? '' : 'hidden rail:block'}>
        {hasDetail ? (
          <>
            <Link
              to={backTo}
              className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary rail:hidden"
            >
              <Icon name="arrow_back" className="text-base" />
              {backLabel}
            </Link>
            {detail}
          </>
        ) : (
          (emptyDetail ?? null)
        )}
      </div>
    </div>
  );
}
