import type { NotificationKind, NotificationView } from '@shared/types';

export type InboxCategory = 'all' | 'notices' | 'violations' | 'sanctions' | 'appointments' | 'clearance' | 'account';

export const INBOX_PAGE_SIZE = 8;

/** Which chip a notification belongs to (deck: All, Violations, Sanctions, Appointments, plus Clearance and Account). */
export function inboxCategory(kind: NotificationKind): Exclude<InboxCategory, 'all'> {
  switch (kind) {
    case 'report':
    case 'case':
    case 'esc':
    case 'newviol':
      return 'violations';
    case 'sanction':
      return 'sanctions';
    case 'appt':
      return 'appointments';
    case 'clr':
      return 'clearance';
    case 'account':
      return 'account';
    case 'notice':
      return 'notices';
  }
}

export const INBOX_CATEGORY_LABEL: Record<InboxCategory, string> = {
  all: 'All',
  notices: 'Important notices',
  violations: 'Violations',
  sanctions: 'Sanctions',
  appointments: 'Appointments',
  clearance: 'Clearance',
  account: 'Account',
};

export function filterInbox(items: NotificationView[], category: InboxCategory, unreadOnly: boolean): NotificationView[] {
  return items.filter((item) => (category === 'all' || inboxCategory(item.kind) === category) && (!unreadOnly || !item.isRead));
}

/** Counts per chip over the whole list (not the page), for the chip badges. */
export function categoryCounts(items: NotificationView[]): Record<InboxCategory, number> {
  const counts: Record<InboxCategory, number> = { all: items.length, notices: 0, violations: 0, sanctions: 0, appointments: 0, clearance: 0, account: 0 };
  for (const item of items) counts[inboxCategory(item.kind)] += 1;
  return counts;
}

export function pageOf<T>(items: T[], page: number, size = INBOX_PAGE_SIZE): { rows: T[]; pages: number; page: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { rows: items.slice((current - 1) * size, current * size), pages, page: current };
}
