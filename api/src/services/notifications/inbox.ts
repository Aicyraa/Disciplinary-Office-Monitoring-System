import type { NotificationKind, NotificationLinkType, NotificationView } from '@shared/types.js';
import { linkPath } from './links.js';

/** Whose inbox: one student's own, or the single shared staff inbox (all staff see the same rows). */
export type Audience = { kind: 'student'; studentId: string } | { kind: 'staff' };

export interface InboxRow {
  notificationId: number;
  kind: NotificationKind;
  title: string;
  message: string;
  linkType: NotificationLinkType | null;
  linkId: number | null;
  isRead: boolean;
  dateCreated: Date;
}

/** Reads and read-marking, always scoped by the audience so one student can never touch another's rows. */
export interface InboxStore {
  /** Newest first. */
  list(audience: Audience, options: { limit: number; unreadOnly: boolean }): Promise<InboxRow[]>;
  unreadCount(audience: Audience): Promise<number>;
  /** False when the notification does not exist or is not in this audience's inbox. */
  markRead(audience: Audience, notificationId: number): Promise<boolean>;
  markAllRead(audience: Audience): Promise<number>;
}

export function toNotificationView(row: InboxRow, audience: Audience): NotificationView {
  return {
    id: row.notificationId,
    kind: row.kind,
    title: row.title,
    message: row.message,
    isRead: row.isRead,
    dateCreated: row.dateCreated.toISOString(),
    href: linkPath(audience.kind, row.linkType, row.linkId),
  };
}

/** Anything that can add a notification outside a case or sanction transaction (account changes). */
export interface NotificationWriter {
  /** Idempotent on `idempotencyKey`. */
  add(input: {
    recipient: 'student' | 'staff';
    studentId: string | null;
    kind: NotificationKind;
    title: string;
    message: string;
    linkType: NotificationLinkType | null;
    linkId: number | null;
    idempotencyKey: string;
  }): Promise<void>;
}
