import type { NotificationKind, NotificationLinkType } from '@shared/types.js';
import type { Audience, InboxRow, InboxStore, NotificationWriter } from '../../services/notifications/inbox.js';

export interface MemoryNotification {
  notificationId: number;
  recipientType: 'student' | 'staff';
  studentId: string | null;
  kind: NotificationKind;
  title: string;
  message: string;
  linkType: NotificationLinkType | null;
  linkId: number | null;
  idempotencyKey: string;
  isRead: boolean;
  dateCreated: Date;
}

export interface MemoryNotifications extends InboxStore, NotificationWriter {
  readonly rows: MemoryNotification[];
}

const inAudience = (row: MemoryNotification, audience: Audience): boolean =>
  audience.kind === 'staff'
    ? row.recipientType === 'staff'
    : row.recipientType === 'student' && row.studentId === audience.studentId;

/** In-memory inbox and writer for tests; scopes by audience exactly as the real store must. */
export function createMemoryNotifications(
  seed: MemoryNotification[] = [],
  now: () => Date = () => new Date(),
  /** Ids of notices past their expiry; their notifications are hidden from every inbox. */
  expiredNoticeIds: () => number[] = () => [],
): MemoryNotifications {
  const rows = [...seed];
  const hidden = (row: MemoryNotification): boolean => row.kind === 'notice' && row.linkId !== null && expiredNoticeIds().includes(row.linkId);
  let nextId = rows.reduce((max, row) => Math.max(max, row.notificationId), 0) + 1;
  const toRow = (row: MemoryNotification): InboxRow => ({
    notificationId: row.notificationId,
    kind: row.kind,
    title: row.title,
    message: row.message,
    linkType: row.linkType,
    linkId: row.linkId,
    isRead: row.isRead,
    dateCreated: row.dateCreated,
  });

  return {
    rows,
    async list(audience, { limit, unreadOnly }) {
      return rows
        .filter((row) => inAudience(row, audience) && !hidden(row) && (!unreadOnly || !row.isRead))
        .sort((a, b) => b.dateCreated.getTime() - a.dateCreated.getTime() || b.notificationId - a.notificationId)
        .slice(0, limit)
        .map(toRow);
    },
    async unreadCount(audience) {
      return rows.filter((row) => inAudience(row, audience) && !hidden(row) && !row.isRead).length;
    },
    async markRead(audience, notificationId) {
      const row = rows.find((candidate) => candidate.notificationId === notificationId && inAudience(candidate, audience));
      if (!row) return false;
      row.isRead = true;
      return true;
    },
    async markAllRead(audience) {
      let count = 0;
      for (const row of rows) {
        if (inAudience(row, audience) && !row.isRead) {
          row.isRead = true;
          count += 1;
        }
      }
      return count;
    },
    async add(input) {
      if (rows.some((row) => row.idempotencyKey === input.idempotencyKey)) return;
      rows.push({
        notificationId: nextId++,
        recipientType: input.recipient,
        studentId: input.studentId,
        kind: input.kind,
        title: input.title,
        message: input.message,
        linkType: input.linkType,
        linkId: input.linkId,
        idempotencyKey: input.idempotencyKey,
        isRead: false,
        dateCreated: now(),
      });
    },
  };
}
