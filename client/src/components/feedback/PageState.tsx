import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Skeleton } from '@/components/feedback/Skeleton';
import { cn } from '@/utils/cn';

/** The four page states of the deck (W86 to W89, src 386 to 422), with the source's exact words. */

function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none', className)}
    />
  );
}

/** Grey blocks shaped like a page: three tiles, then two panels. The label is for screen readers only. */
export function PageLoading({ page }: { page: string }) {
  return (
    <section aria-busy="true" aria-label={`${page} loading`} className="flex flex-col gap-4">
      <span role="status" className="sr-only">
        Loading {page}…
      </span>
      <div aria-hidden="true" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-5">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <div aria-hidden="true" className="flex flex-wrap gap-4">
        <Skeleton className="h-80 flex-[1_1_380px] rounded-xl" />
        <Skeleton className="h-80 flex-[1_1_300px] rounded-xl" />
      </div>
    </section>
  );
}

function StateCard({ tone = 'plain', role, children }: { tone?: 'plain' | 'error'; role?: 'alert'; children: ReactNode }) {
  return (
    <section
      role={role}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border bg-white px-5 py-16 text-center',
        tone === 'error' ? 'border-danger-line' : 'border-line',
      )}
    >
      {children}
    </section>
  );
}

export function PageEmpty({ text }: { text: string }) {
  return (
    <StateCard>
      <Icon name="inbox" className="!text-[40px] text-disabled" />
      <h2 className="text-xl font-bold text-ink">Nothing here yet</h2>
      <p className="max-w-[420px] text-muted">{text}</p>
    </StateCard>
  );
}

/** A record that does not exist (a wrong or removed link): said plainly, and not blamed on the connection. */
export function PageNotFound({ what = 'page', backTo, backLabel }: { what?: string; backTo?: string; backLabel?: string }) {
  return (
    <StateCard>
      <Icon name="search_off" className="!text-[40px] text-disabled" />
      <h2 className="text-xl font-bold text-ink">We couldn’t find that {what}</h2>
      <p className="max-w-[420px] text-muted">It may have been removed, or the link may be wrong.</p>
      {backTo ? (
        <Link to={backTo} className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'mt-2')}>
          {backLabel ?? 'Go back'}
        </Link>
      ) : null}
    </StateCard>
  );
}

/** What kind of failure is it: only a 404 means "not found"; no answer or a server fault stays a load failure. */
export function isNotFoundStatus(status: number | undefined): boolean {
  return status === 404;
}

/**
 * A failed load. `detail` is the API's own message, shown under the fixed sentence. Pass the ApiError `status`
 * for a single record: a 404 then shows the not-found state (`what` names the record) instead of "check your connection".
 */
export function PageError({
  page = 'this page',
  detail,
  onRetry,
  status,
  what,
}: {
  page?: string;
  detail?: string;
  onRetry?: () => void;
  status?: number;
  what?: string;
}) {
  if (isNotFoundStatus(status)) return <PageNotFound what={what ?? page.replace(/^this /, '')} />;
  return (
    <StateCard tone="error" role="alert">
      <Icon name="cloud_off" className="!text-[40px] text-danger" />
      <h2 className="text-xl font-bold text-ink">Couldn’t load {page}</h2>
      <p className="max-w-[420px] text-muted">The server didn’t respond. Nothing was changed. Check your connection and try again.</p>
      {detail ? <p className="max-w-[420px] text-[13px] text-muted-2">{detail}</p> : null}
      {onRetry ? (
        <Button size="lg" className="mt-2" onClick={onRetry}>
          <Icon name="refresh" className="!text-xl" />
          Try again
        </Button>
      ) : null}
    </StateCard>
  );
}

export function PageNoAccess({ page = 'this page' }: { page?: string }) {
  return (
    <StateCard>
      <Icon name="lock" className="!text-[40px] text-warn-ink" />
      <h2 className="text-xl font-bold text-ink">You don’t have access to {page}</h2>
      <p className="max-w-[440px] text-muted">
        Your account role doesn’t include this page. If you think this is a mistake, contact the Student Discipline Office.
      </p>
      <Link to="/" className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'mt-2')}>
        Go to dashboard
      </Link>
    </StateCard>
  );
}

/** Student only, after sign-in (src 2074): the unread count with a shortcut to the inbox. */
export function NudgeCard({ text, onDismiss }: { text: string; onDismiss: () => void }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-[340px] max-w-[calc(100vw-32px)] items-center gap-3 rounded-xl border border-line bg-white py-3.5 pr-3.5 pl-4 shadow-[0_16px_40px_rgba(16,22,52,0.18)]"
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-info-soft text-primary">
        <Icon name="notifications_active" className="!text-xl" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
        <p className="text-sm font-semibold text-ink">{text}</p>
        <Link to="/inbox" onClick={onDismiss} className={buttonVariants({ size: 'sm' })}>
          Open inbox
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-line-soft"
      >
        <Icon name="close" className="!text-xl" />
      </button>
    </div>
  );
}

export { Spinner };
