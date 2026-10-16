import { BADGE_POLL_MS } from './revalidate';

/** Poll interval once nobody has touched the page for `IDLE_AFTER_MS` (PERFORMANCE-SPEC F3). */
export const IDLE_POLL_MS = 120_000;
/** No pointer or key input for this long counts as an idle tab. */
export const IDLE_AFTER_MS = 5 * 60_000;

/** The next wait: the normal badge interval while someone is using the page, longer once it sits idle. */
export function nextPollDelay(lastActivityAt: number, now: number): number {
  return now - lastActivityAt >= IDLE_AFTER_MS ? IDLE_POLL_MS : BADGE_POLL_MS;
}

export interface PollerOptions {
  /** One refresh. A rejection is ignored (a badge must never break a page). */
  run(): Promise<unknown>;
  isVisible(): boolean;
  now?: () => number;
}

export interface Poller {
  /** Refresh now and start the timer. */
  start(): void;
  stop(): void;
  /** Refresh now if the tab is visible and no refresh is running (tab focus, a page change, a manual refresh). */
  trigger(): void;
  /** The user did something; polling returns to the normal interval. */
  markActivity(): void;
}

/**
 * Badge polling that never wakes the database for nobody: a hidden tab makes no requests, a refresh never runs
 * in parallel with another, and an idle tab backs off to `IDLE_POLL_MS`. No DOM here; the hook wires the events.
 */
export function createPoller({ run, isVisible, now = Date.now }: PollerOptions): Poller {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let stopped = true;
  let lastActivityAt = now();

  const refresh = (force: boolean) => {
    if (inFlight || (!force && !isVisible())) return;
    inFlight = true;
    run()
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
      });
  };

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      refresh(false);
      schedule();
    }, nextPollDelay(lastActivityAt, now()));
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      // The first load always runs: the page was just opened and needs its numbers.
      refresh(true);
      schedule();
    },
    stop() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
    trigger() {
      refresh(false);
    },
    markActivity() {
      const wasIdle = nextPollDelay(lastActivityAt, now()) === IDLE_POLL_MS;
      lastActivityAt = now();
      // Coming back from idle: restart the wait at the normal interval instead of finishing the long one.
      if (wasIdle && !stopped) {
        if (timer !== null) clearTimeout(timer);
        schedule();
      }
    },
  };
}
