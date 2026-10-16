import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AccountRole } from '@shared/types';
import { notificationsApi } from '@/api/notifications';
import { usePoller } from '@/hooks/usePoller';
import { hasNewNotifications } from '@/utils/revalidate';

const TOAST_MS = 7_000;

interface UnreadContextValue {
  unreadCount: number;
  /** Replace the count (an action already returned the new value). */
  setUnreadCount(count: number): void;
  refresh(): void;
  /** Goes up by one each time a poll finds new notifications; data hooks use it to refresh quietly. */
  changeSignal: number;
  /** "You have N unread" toast, shown once after sign-in. Null when there is nothing to show. */
  toast: string | null;
  dismissToast(): void;
}

const UnreadContext = createContext<UnreadContextValue | null>(null);

export function unreadMessage(count: number): string {
  return count === 1 ? 'You have 1 unread notification.' : `You have ${count} unread notifications.`;
}

/** Badge text: nothing for zero, and "99+" so a long number never breaks the layout. */
export function badgeText(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

export function UnreadProvider({ role, children }: { role: AccountRole; children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [changeSignal, setChangeSignal] = useState(0);
  const announced = useRef(false);
  const lastCount = useRef<number | null>(null);

  // A failed badge refresh must never break the page: the poller swallows it and the badge keeps its last value.
  const load = useCallback(
    () =>
      notificationsApi.notifications(role, { limit: 1 }).then(({ unreadCount: count }) => {
        if (hasNewNotifications(lastCount.current, count)) setChangeSignal((value) => value + 1);
        lastCount.current = count;
        setUnreadCount(count);
        // The "you have N unread" toast is shown once per sign-in, on the first load.
        if (!announced.current) {
          announced.current = true;
          if (count > 0) setToast(unreadMessage(count));
        }
      }),
    [role],
  );
  // Poll only while the tab is visible, one request at a time, slower when idle; coming back refreshes at once.
  const refresh = usePoller(load);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo<UnreadContextValue>(
    () => ({ unreadCount, setUnreadCount, refresh, changeSignal, toast, dismissToast: () => setToast(null) }),
    [unreadCount, refresh, changeSignal, toast],
  );
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

/** The change signal for data hooks; 0 and never changing outside a provider (public pages, tests). */
export function useChangeSignal(): number {
  return useContext(UnreadContext)?.changeSignal ?? 0;
}

export function useUnread(): UnreadContextValue {
  const value = useContext(UnreadContext);
  if (!value) throw new Error('useUnread must be used inside <UnreadProvider>');
  return value;
}
