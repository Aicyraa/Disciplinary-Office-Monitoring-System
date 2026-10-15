import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Spinner } from '@/components/feedback/PageState';
import { Alert } from '@/components/ui/Alert';
import { buttonVariants } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import type { ApiResource } from '@/hooks/useApi';
import { cn } from '@/utils/cn';

/** A card's body while its data loads or fails: a quiet line, never a full page state inside a card. */
export function CardBody<T>({ resource, children }: { resource: ApiResource<T> & { reload(): void }; children: (data: T) => ReactNode }) {
  if (resource.status === 'loading') {
    return (
      <p role="status" className="flex items-center gap-2 text-[13px] text-muted">
        <Spinner />
        Loading…
      </p>
    );
  }
  if (resource.status === 'error') {
    return (
      <Alert tone="error">
        {resource.error.message}{' '}
        <button type="button" onClick={resource.reload} className="font-semibold underline">
          Try again
        </button>
      </Alert>
    );
  }
  return <>{children(resource.data)}</>;
}

/** The row action pill (deck src 450): primary outline that fills on hover. */
export const ACTION_PILL = cn(
  buttonVariants({ variant: 'secondary', size: 'sm' }),
  'min-h-11 shrink-0 hover:bg-primary hover:text-white rail:min-h-[34px]',
);

const TONES = {
  bad: 'bg-bad-soft text-bad-ink',
  warn: 'bg-warn-soft text-warn-ink',
  info: 'bg-info-soft text-primary',
  success: 'bg-success-soft text-success',
} as const;

/**
 * A dashboard card (deck src 429): tinted icon tile, title and subtitle, a gold "View all ›" pill, then the
 * content. `actionAtBottom` puts the pill under the content (the student's Active violations card).
 */
export function DashboardCard({
  icon,
  tone = 'info',
  title,
  subtitle,
  to,
  action = 'View all',
  actionLabel,
  actionAtBottom = false,
  children,
  className = '',
}: {
  icon: string;
  tone?: keyof typeof TONES;
  title: string;
  subtitle?: ReactNode;
  /** Where the pill goes. Omitted: no pill. */
  to?: string;
  action?: string;
  /** Screen-reader name of the pill ("Open Cases"). */
  actionLabel?: string;
  actionAtBottom?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const headingId = `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const pill = to ? (
    <Link
      to={to}
      aria-label={actionLabel}
      className="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded-full border border-gold-line bg-gold pr-2 pl-3.5 text-[13px] font-semibold whitespace-nowrap text-ink hover:bg-gold-hover focus-visible:ring-[3px] focus-visible:ring-gold-line/45 focus-visible:outline-none rail:min-h-9"
    >
      {action}
      <Icon name="chevron_right" className="!text-lg" />
    </Link>
  ) : null;
  return (
    <section aria-labelledby={headingId} className={cn('flex min-w-0 flex-col gap-4 rounded-xl border border-line bg-white px-[22px] py-5', className)}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-[10px]', TONES[tone])}>
          <Icon name={icon} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="text-[17px] leading-tight font-bold text-ink">
            {title}
          </h2>
          {subtitle ? <div className="text-[13px] leading-snug text-muted">{subtitle}</div> : null}
        </div>
        {actionAtBottom ? null : pill}
      </div>
      {children}
      {actionAtBottom && pill ? <div className="mt-auto flex justify-end">{pill}</div> : null}
    </section>
  );
}

/** The three small numbers under a card head. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

/** The bordered list of rows inside a card (deck src 443). */
export function RowBox({ children }: { children: ReactNode }) {
  // Three rows tall even when empty, so a card keeps its size whether or not it has items.
  return <div className="flex min-h-[172px] flex-1 flex-col overflow-hidden rounded-[10px] border border-line-soft">{children}</div>;
}

/** One row: title (+ red flag), muted line, and an action on the right. */
export function DashRow({ title, flag, sub, action }: { title: string; flag?: ReactNode; sub: string; action?: ReactNode }) {
  return (
    <div className="-mb-px flex min-h-14 items-center gap-3 border-b border-line-soft px-3.5 py-2">
      <div className="min-w-0 flex-1 leading-snug">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{title}</span>
          {flag}
        </div>
        <div className="truncate text-xs text-muted">{sub}</div>
      </div>
      {action}
    </div>
  );
}

/** A whole row that opens its record (the student's rows, deck src 1017): title, muted line, status pill. */
export function LinkRow({ to, title, sub, end }: { to: string; title: string; sub: string; end?: ReactNode }) {
  return (
    <Link
      to={to}
      className="-mb-px flex min-h-[52px] items-center gap-2.5 border-b border-line-soft bg-white px-3.5 py-2 hover:bg-tint-soft focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)] focus-visible:outline-none"
    >
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block truncate text-sm font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-muted">{sub}</span>
      </span>
      {end}
    </Link>
  );
}

/** A quiet centered line for an empty list ("No current sanctions."). `dashed` draws its own box. */
export function EmptyLine({ children, dashed = false }: { children: ReactNode; dashed?: boolean }) {
  return (
    <p className={cn('px-3 text-center text-[13px] text-muted', dashed ? 'rounded-[10px] border border-dashed border-line py-3.5' : 'py-[18px]')}>{children}</p>
  );
}

/** A small red flag next to a row title ("Will escalate", "Overdue"). */
export function Flag({ children }: { children: ReactNode }) {
  return <span className="shrink-0 rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-semibold text-bad-ink">{children}</span>;
}

/** "No reports waiting." in green with a check (deck src 453). */
export function AllClear({ children }: { children: ReactNode }) {
  return (
    <div className="my-auto flex items-center justify-center gap-1.5 px-3 py-[18px] text-[13px] font-semibold text-success">
      <Icon name="check_circle" className="!text-lg" />
      {children}
    </div>
  );
}

/** A thin progress bar with an accessible name. */
export function ProgressBar({ percent, label, tone = 'gold' }: { percent: number; label: string; tone?: 'gold' | 'green' | 'primary' }) {
  const fill = tone === 'green' ? 'bg-success-strong' : tone === 'primary' ? 'bg-primary' : 'bg-gold-line';
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-line-soft">
      <div className={cn('h-full rounded-full', fill)} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** The month and day of a date as a tile (the "MON 12 Oct" tile, deck src 1035). */
export function DateTile({ date, past = false }: { date: string; past?: boolean }) {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const weekday = parsed.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase();
  const month = parsed.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return (
    <div
      aria-hidden="true"
      className={cn('flex w-[58px] shrink-0 flex-col items-center rounded-lg py-1.5 leading-tight', past ? 'bg-line-soft text-neutral-ink' : 'bg-primary text-white')}
    >
      <span className="text-[11px] font-bold tracking-[0.06em]">{weekday}</span>
      <span className="text-2xl font-extrabold">{parsed.getUTCDate()}</span>
      <span className="text-[11px] font-semibold">{month}</span>
    </div>
  );
}
