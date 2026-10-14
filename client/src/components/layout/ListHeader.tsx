import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { usePageActionValue } from './PageAction';

/**
 * The opening row of a staff list card: title and subtitle on the left, the page's create action as a labelled
 * pill on the right. The pill is desktop only; on a phone the shell's floating button runs the same action.
 */
export function ListHeader({ title, subtitle, className }: { title: string; subtitle: string; className?: string }) {
  const action = usePageActionValue();
  return (
    <div className={cn('flex items-center justify-between gap-3 border-b border-line-soft px-6 py-[18px]', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-[17px] font-bold text-ink">{title}</h2>
        <p className="truncate text-[13px] text-muted">{subtitle}</p>
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="hidden h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary pr-4 pl-3 text-sm font-semibold whitespace-nowrap text-white outline-none hover:bg-primary-hover active:bg-primary-press focus-visible:ring-[3px] focus-visible:ring-primary/35 rail:inline-flex"
        >
          <Icon name="add" className="!text-xl" />
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
