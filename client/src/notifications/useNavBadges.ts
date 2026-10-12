import { useCallback, useEffect, useState } from 'react';
import type { AccountRole } from '@shared/types';
import { api } from '../lib/api';

export interface NavBadges {
  /** Staff: reports waiting for review. */
  cases: number;
  /** Staff: sanctions waiting for verification. */
  students: number;
}

const POLL_MS = 60_000;

/**
 * Counts for the sidebar badges (the Inbox badge comes from the unread context). Staff only: students have
 * no count badges. A failed refresh keeps the last numbers; a badge must never break a page.
 */
export function useNavBadges(role: AccountRole, refreshKey: string): NavBadges {
  const [badges, setBadges] = useState<NavBadges>({ cases: 0, students: 0 });

  const refresh = useCallback(() => {
    if (role !== 'staff') return;
    void Promise.all([api.staffCases({ status: 'reported', page: 1 }), api.sanctionQueue({ filter: 'pending_verification' })]).then(
      ([cases, queue]) => setBadges({ cases: cases.total, students: queue.counts.pendingVerification }),
      () => undefined,
    );
  }, [role]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return badges;
}
