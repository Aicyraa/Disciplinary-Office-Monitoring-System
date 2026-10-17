import seal from '@/assets/seal.png';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

/**
 * The whole screen when the app opens with nothing loaded: no internet, or the server cannot be reached.
 * `online` is the browser's flag, so the wording names the likely cause.
 */
export function OfflineScreen({ online, onRetry }: { online: boolean; onRetry: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-page px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-center">
      <img src={seal} alt="NU Fairview" className="size-16 opacity-90" />
      <section role="alert" className="flex w-full max-w-[400px] flex-col items-center gap-2 rounded-xl border border-danger-line bg-white px-6 py-10">
        <span aria-hidden="true" className="mb-1 grid size-16 place-items-center rounded-full bg-bad-soft text-danger">
          <Icon name={online ? 'cloud_off' : 'wifi_off'} className="!text-[36px]" />
        </span>
        <h1 className="text-xl font-bold text-ink">{online ? 'Can’t reach the SDO Portal' : 'No internet connection'}</h1>
        <p className="max-w-[320px] text-sm text-pretty text-muted">
          {online
            ? 'The server didn’t respond. Nothing was changed. Try again in a moment.'
            : 'The SDO Portal needs the internet to load your records. Turn on Wi-Fi or mobile data, then try again.'}
        </p>
        <Button size="lg" className="mt-3" onClick={onRetry}>
          <Icon name="refresh" className="!text-xl" />
          Try again
        </Button>
      </section>
    </main>
  );
}

/** A thin strip on top while the connection drops mid-use; what was already loaded stays on screen. */
export function OfflineBanner() {
  return (
    <p
      role="status"
      className="fixed inset-x-0 top-0 z-[95] flex items-center justify-center gap-2 bg-ink px-4 pt-[calc(6px+env(safe-area-inset-top))] pb-1.5 text-[13px] font-semibold text-white print:hidden"
    >
      <Icon name="wifi_off" className="!text-lg" />
      No internet connection. Changes can’t be saved until you’re back online.
    </p>
  );
}
