export interface DeliveryScheduler {
  /** Run a delivery pass soon, in the background. Safe to call from anywhere, any number of times. */
  kick(): void;
  /** Start the periodic sweep (also catches rows left pending by an outage). */
  start(): void;
  stop(): void;
}

export interface SchedulerOptions {
  run: () => Promise<unknown>;
  intervalMs: number;
  onError?: (error: unknown) => void;
}

/**
 * Runs delivery passes one at a time. A `kick` while a pass is running does not start a second one (that could
 * send the same email twice); it asks for one more pass right after. Never blocks the caller, never throws.
 */
export function createDeliveryScheduler({ run, intervalMs, onError = (error) => console.error('Delivery pass failed', error) }: SchedulerOptions): DeliveryScheduler {
  let running = false;
  let again = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function pass(): Promise<void> {
    running = true;
    try {
      do {
        again = false;
        try {
          await run();
        } catch (error) {
          onError(error);
        }
      } while (again);
    } finally {
      running = false;
    }
  }

  const kick = () => {
    if (running) {
      again = true;
      return;
    }
    void pass();
  };

  return {
    kick,
    start() {
      if (timer !== null) return;
      timer = setInterval(kick, intervalMs);
      // Do not keep the process alive just for the sweep.
      timer.unref?.();
    },
    stop() {
      if (timer !== null) clearInterval(timer);
      timer = null;
    },
  };
}
