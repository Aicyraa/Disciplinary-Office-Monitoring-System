import type { ReactNode } from 'react';
import { pillTone, statusLabel, type StatusKind } from '@/utils/format';
import type { ApiResource } from '@/hooks/useApi';

export { Icon } from './Icon';
import { EmptyBlock } from './EmptyBlock';
import { PageError, Spinner } from '@/components/feedback/PageState';

export function StatusPill({ status, label, kind }: { status: string; label?: string; kind?: StatusKind }) {
  const tone = pillTone(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      {label ?? statusLabel(status, kind)}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions}
    </header>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-line bg-white p-4 ${className}`}>{children}</section>;
}

/** Inside a pane: the spinner line and a few grey bars. The label stays readable for screen readers. */
export function LoadingState({ label = 'Loading…', cards = 3 }: { label?: string; cards?: number }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-3 py-2">
      <span className="flex items-center gap-2.5 text-sm text-muted">
        <Spinner />
        {label}
      </span>
      {Array.from({ length: cards }, (_, index) => (
        <div key={index} aria-hidden="true" className="h-16 rounded-xl bg-skeleton" />
      ))}
    </div>
  );
}

/** "Nothing here" inside a pane (deck src 594): icon, title, one line of help, on a white card. */
export function EmptyState({ title, hint, icon = 'inbox' }: { title: string; hint?: string; icon?: string }) {
  return (
    <div className="rounded-xl border border-line bg-white">
      <EmptyBlock icon={icon} title={title}>
        {hint}
      </EmptyBlock>
    </div>
  );
}

/** A failed load in a pane or page: the deck error card, with the API's message as the detail line. */
export function ErrorState({ message, onRetry, page }: { message: string; onRetry?: () => void; page?: string }) {
  return <PageError page={page} detail={message} onRetry={onRetry} />;
}

/** Renders loading and error states, then calls `children` with the data. */
export function Resource<T>({
  resource,
  onRetry,
  children,
}: {
  resource: ApiResource<T>;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}) {
  if (resource.status === 'loading') return <LoadingState />;
  if (resource.status === 'error') {
    return <ErrorState message={resource.error.message} onRetry={onRetry} />;
  }
  return <>{children(resource.data)}</>;
}

export const fieldClass =
  'block min-h-11 w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary';

export const buttonClass =
  'inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-active disabled:opacity-60';
