import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';

const pill =
  'inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold ' +
  'outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35';

/**
 * One proof or template file. Files are PDF only (D7). "View" opens the preview modal in place:
 * no link, no new tab (UI-POLISH-SPEC 4.2b); only the preview's Download saves the file.
 */
export function FileRow({
  name,
  meta,
  viewed = false,
  onView,
  onReplace,
  onRemove,
  className,
}: {
  name: string;
  meta: string;
  /** Staff have opened this file. */
  viewed?: boolean;
  onView: () => void;
  onReplace?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 rounded-[10px] border border-line-soft bg-white p-3', className)}>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-bad-soft text-bad-ink">
        <Icon name="picture_as_pdf" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          <span className="truncate">{name}</span>
          {viewed ? (
            <span className="rounded-full bg-success-soft px-2 py-px text-[11px] font-semibold text-success">Viewed</span>
          ) : null}
        </p>
        <p className="text-xs text-muted">{meta}</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onView} className={cn(pill, 'border-primary bg-white text-primary hover:bg-primary-tint')}>
          <Icon name="visibility" className="!text-[18px]" />
          View
        </button>
        {onReplace ? (
          <button type="button" onClick={onReplace} className={cn(pill, 'border-line-strong bg-white text-ink hover:bg-page')}>
            <Icon name="swap_horiz" className="!text-[18px]" />
            Replace
          </button>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={onRemove}
            className="inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-muted outline-none hover:bg-danger-soft hover:text-danger focus-visible:ring-[3px] focus-visible:ring-primary/35"
          >
            <Icon name="delete" className="!text-[20px]" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
