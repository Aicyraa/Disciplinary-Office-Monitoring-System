import type { ReactNode } from 'react';
import { pillTone, statusLabel, type StatusKind } from '@/utils/format';

export { Icon } from './Icon';

export function StatusPill({ status, label, kind }: { status: string; label?: string; kind?: StatusKind }) {
  const tone = pillTone(status);
  return (
    <span
      className="inline-flex animate-fade-in items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors duration-300"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      {label ?? statusLabel(status, kind)}
    </span>
  );
}

/**
 * Inside the app the breadcrumb is the page title (deck: no page header), so the heading is for screen readers
 * only and the subtitle is dropped; actions stay until each screen's slice moves them. `visible` is for the
 * screens outside the app frame.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  visible = false,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  visible?: boolean;
}) {
  if (!visible) {
    return (
      <>
        <h1 className="sr-only">{title}</h1>
        {actions ? <div className="mb-4 flex flex-wrap justify-end gap-2">{actions}</div> : null}
      </>
    );
  }
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
