import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createPoller, IDLE_AFTER_MS, IDLE_POLL_MS, nextPollDelay } from '@/utils/poller';
import { BADGE_POLL_MS } from '@/utils/revalidate';

describe('nextPollDelay', () => {
  test('normal interval while the page is in use, longer once idle', () => {
    expect(nextPollDelay(0, IDLE_AFTER_MS - 1)).toBe(BADGE_POLL_MS);
    expect(nextPollDelay(0, IDLE_AFTER_MS)).toBe(IDLE_POLL_MS);
  });
});

describe('createPoller', () => {
  let visible: boolean;
  let calls: number;
  let pending: Array<() => void>;
  const run = () => {
    calls += 1;
    return new Promise<void>((resolve) => pending.push(resolve));
  };
  const settle = async () => {
    for (const resolve of pending.splice(0)) resolve();
    await vi.advanceTimersByTimeAsync(0);
  };

  beforeEach(() => {
    vi.useFakeTimers();
    visible = true;
    calls = 0;
    pending = [];
  });
  afterEach(() => vi.useRealTimers());

  const make = () => createPoller({ run, isVisible: () => visible, now: () => Date.now() });

  test('loads once at start, then once per interval while visible', async () => {
    const poller = make();
    poller.start();
    expect(calls).toBe(1);
    await settle();
    await vi.advanceTimersByTimeAsync(BADGE_POLL_MS);
    expect(calls).toBe(2);
    poller.stop();
  });

  test('a hidden tab makes no requests', async () => {
    const poller = make();
    poller.start();
    await settle();
    visible = false;
    await vi.advanceTimersByTimeAsync(BADGE_POLL_MS * 10);
    poller.trigger();
    expect(calls).toBe(1);
    poller.stop();
  });

  test('coming back to the tab refreshes at once', async () => {
    const poller = make();
    poller.start();
    await settle();
    visible = false;
    await vi.advanceTimersByTimeAsync(BADGE_POLL_MS);
    visible = true;
    poller.trigger();
    expect(calls).toBe(2);
    poller.stop();
  });

  test('never two refreshes at once: a trigger while one is running is dropped', async () => {
    const poller = make();
    poller.start();
    poller.trigger();
    poller.trigger();
    expect(calls).toBe(1);
    await settle();
    poller.trigger();
    expect(calls).toBe(2);
    poller.stop();
  });

  test('an idle tab backs off, and activity brings the normal interval back', async () => {
    const poller = make();
    poller.start();
    await settle();
    // Nobody touches the page: after the idle threshold the wait becomes IDLE_POLL_MS.
    await vi.advanceTimersByTimeAsync(IDLE_AFTER_MS);
    await settle();
    const before = calls;
    await vi.advanceTimersByTimeAsync(BADGE_POLL_MS);
    expect(calls).toBe(before);
    poller.markActivity();
    await vi.advanceTimersByTimeAsync(BADGE_POLL_MS);
    expect(calls).toBe(before + 1);
    poller.stop();
  });

  test('a failed refresh is swallowed and polling continues', async () => {
    let fail = true;
    const poller = createPoller({
      run: () => {
        calls += 1;
        return fail ? Promise.reject(new Error('offline')) : Promise.resolve();
      },
      isVisible: () => true,
    });
    poller.start();
    await vi.advanceTimersByTimeAsync(0);
    fail = false;
    await vi.advanceTimersByTimeAsync(BADGE_POLL_MS);
    expect(calls).toBe(2);
    poller.stop();
  });

  test('stop ends the timer', async () => {
    const poller = make();
    poller.start();
    await settle();
    poller.stop();
    await vi.advanceTimersByTimeAsync(BADGE_POLL_MS * 5);
    expect(calls).toBe(1);
  });
});
