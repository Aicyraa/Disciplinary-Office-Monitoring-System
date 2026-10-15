import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AccountRole } from '@shared/types';
import { notificationsApi } from '@/api/notifications';
import { BADGE_POLL_MS, shouldPoll } from '@/utils/revalidate';

const TOAST_MS = 7_000;

interface UnreadContextValue {
  unreadCount: number;
  /** Replace the count (an action already returned the new value). */
  setUnreadCount(count: number): void;
  refresh(): void;
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
  const announced = useRef(false);

  const refresh = useCallback(() => {
    notificationsApi.notifications(role, { limit: 1 }).then(
      ({ unreadCount: count }) => {
        setUnreadCount(count);
        // The "you have N unread" toast is shown once per sign-in, on the first load.
        if (!announced.current) {
          announced.current = true;
          if (count > 0) setToast(unreadMessage(count));
        }
      },
      // A failed badge refresh must never break the page: the badge simply keeps its last value.
      () => undefined,
    );
  }, [role]);

  useEffect(() => {
    refresh();
    // Poll only while the tab is visible; coming back to the tab refreshes at once.
    const refreshIfVisible = () => {
      if (shouldPoll(document.visibilityState)) refresh();
    };
    const timer = setInterval(refreshIfVisible, BADGE_POLL_MS);
    document.addEventListener('visibilitychange', refreshIfVisible);
    window.addEventListener('focus', refreshIfVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.removeEventListener('focus', refreshIfVisible);
    };
  }, [refresh]);

  useEffect(() => {
    if (toast === null) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo<UnreadContextValue>(
    () => ({ unreadCount, setUnreadCount, refresh, toast, dismissToast: () => setToast(null) }),
    [unreadCount, refresh, toast],
  );
  return <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>;
}

export function useUnread(): UnreadContextValue {
  const value = useContext(UnreadContext);
  if (!value) throw new Error('useUnread must be used inside <UnreadProvider>');
  return value;
}
