import { useEffect, useRef } from 'react';
import { createPoller, type Poller } from '@/utils/poller';
import { shouldPoll } from '@/utils/revalidate';

/**
 * Polls `run` with the badge rules of `utils/poller.ts` (visible tab only, one request at a time, slower when
 * idle) and refreshes when the tab comes back. Returns `trigger`, which refreshes now under the same rules.
 * `enabled: false` makes no requests at all.
 */
export function usePoller(run: () => Promise<unknown>, enabled = true): () => void {
  const runRef = useRef(run);
  runRef.current = run;
  const pollerRef = useRef<Poller | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const poller = createPoller({ run: () => runRef.current(), isVisible: () => shouldPoll(document.visibilityState) });
    pollerRef.current = poller;
    const onReturn = () => {
      poller.markActivity();
      poller.trigger();
    };
    const onActivity = () => poller.markActivity();
    poller.start();
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    return () => {
      poller.stop();
      pollerRef.current = null;
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, [enabled]);

  const trigger = useRef(() => pollerRef.current?.trigger());
  return trigger.current;
}
