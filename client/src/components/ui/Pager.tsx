import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { pagerItems } from '@/utils/pager';

const roundButton =
  'inline-flex h-11 min-w-8 max-w-11 flex-1 items-center justify-center rounded-full text-[13px] font-semibold outline-none rail:size-[34px] rail:flex-none ' +
  'focus-visible:ring-[3px] focus-visible:ring-primary/35';

/** Numbered round pager. Draws nothing when everything fits on one page. */
export function Pager({
  page,
  pageCount,
  onChange,
  className,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-0 py-3 rail:gap-1.5', className)}>
      <button
        type="button"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        className={cn(roundButton, 'text-ink hover:bg-line-soft disabled:text-disabled disabled:hover:bg-transparent')}
      >
        <Icon name="chevron_left" />
      </button>
      {pagerItems(page, pageCount).map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-muted-2">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            aria-label={`Page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            onClick={() => onChange(item)}
            className={cn(roundButton, item === page ? 'bg-primary text-white' : 'text-ink hover:bg-line-soft')}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        className={cn(roundButton, 'text-ink hover:bg-line-soft disabled:text-disabled disabled:hover:bg-transparent')}
      >
        <Icon name="chevron_right" />
      </button>
    </nav>
  );
}
