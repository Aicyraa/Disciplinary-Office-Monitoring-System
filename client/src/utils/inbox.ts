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

const NOTE_ICON: Record<NotificationKind, string> = {
  report: 'flag',
  case: 'gavel',
  esc: 'trending_up',
  sanction: 'assignment',
  appt: 'event',
  clr: 'task_alt',
  account: 'key',
  newviol: 'report',
  notice: 'campaign',
};

const CATEGORY_LOOK: Record<Exclude<InboxCategory, 'all'>, { category: string; tint: string }> = {
  violations: { category: 'Violations', tint: 'bg-bad-soft text-bad-ink' },
  sanctions: { category: 'Sanctions', tint: 'bg-amber-soft text-amber-ink' },
  appointments: { category: 'Appointments', tint: 'bg-info-soft text-info-ink' },
  notices: { category: 'Important notice', tint: 'bg-pending-soft text-warn-ink' },
  clearance: { category: 'Clearance', tint: 'bg-success-soft text-success' },
  account: { category: 'Account', tint: 'bg-neutral-soft text-neutral-ink' },
};

/** Icon, category word and tint of a notification (deck src 2238 to 2242). */
export function notificationLook(kind: NotificationKind): { icon: string; category: string; tint: string } {
  return { icon: NOTE_ICON[kind], ...CATEGORY_LOOK[inboxCategory(kind)] };
}

const manila = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', ...options });

/** "Fri, Oct 9 · 10:40 AM" in Asia/Manila (bell and inbox rows). */
export function notificationWhen(iso: string): string {
  const date = new Date(iso);
  const day = manila({ weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  return `${day} · ${manila({ hour: 'numeric', minute: '2-digit' }).format(date)}`;
}

/** "Wednesday, October 7, 2026 · 3:15 PM" (the message dialog). */
export function notificationWhenLong(iso: string): string {
  const date = new Date(iso);
  const day = manila({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
  return `${day} · ${manila({ hour: 'numeric', minute: '2-digit' }).format(date)}`;
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
