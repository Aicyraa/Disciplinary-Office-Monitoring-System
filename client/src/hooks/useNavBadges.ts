import { useCallback, useEffect, useState } from 'react';
import type { AccountRole } from '@shared/types';
import { casesApi } from '@/api/cases';
import { usePoller } from '@/hooks/usePoller';
import { navBadgesFrom, type NavBadges } from '@/utils/nav';

/**
 * Counts for the sidebar badges (the Inbox badge comes from the unread context). Staff only: students have
 * no count badges. A failed refresh keeps the last numbers; a badge must never break a page.
 * Polls only while the tab is visible, never two refreshes at once, and slower when idle (`usePoller`).
 */
export function useNavBadges(role: AccountRole, refreshKey: string): NavBadges {
  const [badges, setBadges] = useState<NavBadges>({ cases: 0, students: 0 });

  // One counts-only request (GET /staff/summary) instead of a case page plus the sanction queue.
  const load = useCallback(() => casesApi.staffSummary().then((summary) => setBadges(navBadgesFrom(summary))), []);
  const trigger = usePoller(load, role === 'staff');

  // A page change refreshes the numbers (an action on the last page may have changed them).
  useEffect(() => {
    trigger();
  }, [trigger, refreshKey]);

  return badges;
}
