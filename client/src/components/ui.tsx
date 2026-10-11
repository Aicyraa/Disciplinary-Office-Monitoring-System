import type { ReactNode } from 'react';
import { pillTone, statusLabel } from '../lib/format';
import type { ApiResource } from '../lib/useApi';

export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden="true">
      {name}
    </span>
  );
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const tone = pillTone(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      {label ?? statusLabel(status)}
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

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="py-10 text-center text-sm text-muted">
      {label}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-white px-4 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-white px-4 py-6 text-center">
      <p className="font-semibold text-danger">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-md border border-line-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-page"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
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
  'block w-full rounded-md border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-primary';

export const buttonClass =
  'inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-active disabled:opacity-60';
