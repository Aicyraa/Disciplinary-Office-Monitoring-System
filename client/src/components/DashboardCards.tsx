import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui';

/** Pills and row actions are at least 44 px tall (the phone tap-target floor, UI-POLISH-SPEC section 1). */
export const ACTION_PILL = 'inline-flex min-h-11 items-center rounded-full border border-line-strong px-4 text-xs font-semibold text-ink hover:bg-page';

/** A dashboard card: tinted icon, title and subtitle, a gold "View all" pill, then the content (reference slides 12, 30). */
export function DashboardCard({
  icon,
  tone = 'primary',
  title,
  subtitle,
  to,
  action = 'View all',
  children,
  className = '',
}: {
  icon: string;
  tone?: 'primary' | 'danger' | 'gold' | 'success';
  title: string;
  subtitle?: ReactNode;
  /** Where the pill goes. Omitted: no pill. */
  to?: string;
  action?: string;
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    danger: 'bg-[#FDECEA] text-danger',
    gold: 'bg-gold/40 text-[#7A5B00]',
    success: 'bg-[#E4F3EA] text-success',
  } as const;
  const headingId = `card-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  return (
    <section aria-labelledby={headingId} className={`min-w-0 rounded-xl border border-line bg-white p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
            <Icon name={icon} />
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="truncate text-base font-semibold text-ink">
              {title}
            </h2>
            {subtitle ? <div className="text-xs text-muted">{subtitle}</div> : null}
          </div>
        </div>
        {to ? (
          <Link
            to={to}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-gold px-4 text-xs font-semibold text-ink hover:brightness-95"
          >
            {action}
            <Icon name="chevron_right" className="text-base" />
          </Link>
        ) : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** A small number with a label under it. */
export function Kpi({ value, label, tone }: { value: number | string; label: string; tone?: 'danger' | 'success' }) {
  return (
    <div className="rounded-lg bg-page px-3 py-2">
      <div className={`text-2xl font-bold ${tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-ink'}`}>
        {value}
      </div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

/** A thin progress bar with an accessible name. */
export function ProgressBar({ percent, label }: { percent: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 overflow-hidden rounded-full bg-line"
    >
      <div className="h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
    </div>
  );
}

/** One row of a card list: a title, a muted line, and something on the right (a pill or a link). */
export function RowItem({ title, meta, right }: { title: string; meta?: string; right?: ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-ink">{title}</div>
        {meta ? <div className="truncate text-xs text-muted">{meta}</div> : null}
      </div>
      {right}
    </li>
  );
}

/** The month and day of a date as a small tile (the "Mon 12 Oct" tile on the appointment card). */
export function DateTile({ date }: { date: string }) {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  const weekday = parsed.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  const month = parsed.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-primary text-white" aria-hidden="true">
      <span className="text-[10px] font-semibold uppercase">{weekday}</span>
      <span className="text-xl leading-none font-bold">{parsed.getUTCDate()}</span>
      <span className="text-[10px] uppercase">{month}</span>
    </div>
  );
}
