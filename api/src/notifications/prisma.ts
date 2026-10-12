import type { Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { NotificationKind, NotificationLinkType } from '@shared/types.js';
import type { OutboxStore, PendingNotification } from './delivery.js';
import type { Audience, InboxRow, InboxStore, NotificationWriter } from './inbox.js';

type Db = Pick<PrismaClient, 'notifications' | 'student_accounts' | 'employee_accounts'>;

interface NotificationRow {
  notification_id: number;
  recipient_type: string;
  student_id: string | null;
  kind: string;
  title: string;
  message: string;
  link_type: string | null;
  link_id: number | null;
  idempotency_key: string;
  is_read: boolean;
  date_created: Date;
}

const audienceWhere = (audience: Audience): Prisma.notificationsWhereInput =>
  audience.kind === 'staff'
    ? { recipient_type: 'staff' }
    : { recipient_type: 'student', student_id: audience.studentId };

const toInboxRow = (row: NotificationRow): InboxRow => ({
  notificationId: row.notification_id,
  kind: row.kind as NotificationKind,
  title: row.title,
  message: row.message,
  linkType: row.link_type as NotificationLinkType | null,
  linkId: row.link_id,
  isRead: row.is_read,
  dateCreated: row.date_created,
});

/** Prisma-backed inbox: every query carries the audience, so a student only ever reaches their own rows. */
export function createPrismaInboxStore(db: Pick<PrismaClient, 'notifications'>): InboxStore {
  return {
    async list(audience, { limit, unreadOnly }) {
      const rows = await db.notifications.findMany({
        where: { ...audienceWhere(audience), ...(unreadOnly ? { is_read: false } : {}) },
        orderBy: [{ date_created: 'desc' }, { notification_id: 'desc' }],
        take: limit,
      });
      return rows.map(toInboxRow);
    },
    async unreadCount(audience) {
      return db.notifications.count({ where: { ...audienceWhere(audience), is_read: false } });
    },
    async markRead(audience, notificationId) {
      const result = await db.notifications.updateMany({
        where: { notification_id: notificationId, ...audienceWhere(audience) },
        data: { is_read: true },
      });
      return result.count > 0;
    },
    async markAllRead(audience) {
      const result = await db.notifications.updateMany({
        where: { ...audienceWhere(audience), is_read: false },
        data: { is_read: true },
      });
      return result.count;
    },
  };
}

/** Prisma-backed writer for notifications that are not part of a case or sanction transaction. */
export function createPrismaNotificationWriter(db: Pick<PrismaClient, 'notifications'>): NotificationWriter {
  return {
    async add(input) {
      // email_status stays 'pending' (the column default); the delivery sweep sends it.
      await db.notifications.createMany({
        data: [
          {
            recipient_type: input.recipient,
            student_id: input.studentId,
            kind: input.kind,
            title: input.title,
            message: input.message,
            link_type: input.linkType,
            link_id: input.linkId,
            idempotency_key: input.idempotencyKey,
          },
        ],
        skipDuplicates: true,
      });
    },
  };
}

/** Prisma-backed outbox for the delivery sweep. Employee and student rows are read for the email address only. */
export function createPrismaOutboxStore(db: Db): OutboxStore {
  return {
    async listPending(limit) {
      const rows = await db.notifications.findMany({
        where: { email_status: 'pending' },
        orderBy: [{ date_created: 'asc' }, { notification_id: 'asc' }],
        take: limit,
      });
      return rows.map(
        (row): PendingNotification => ({
          notificationId: row.notification_id,
          kind: row.kind as NotificationKind,
          recipientType: row.recipient_type === 'staff' ? 'staff' : 'student',
          studentId: row.student_id,
          title: row.title,
          message: row.message,
          linkType: row.link_type as NotificationLinkType | null,
          linkId: row.link_id,
          idempotencyKey: row.idempotency_key,
          dateCreated: row.date_created,
        }),
      );
    },

    async recipientsOf(row) {
      if (row.recipientType === 'student') {
        if (row.studentId === null) return [];
        const student = await db.student_accounts.findUnique({
          where: { student_id: row.studentId },
          select: { student_email: true, first_name: true, is_active: true },
        });
        return student && student.is_active ? [{ email: student.student_email, firstName: student.first_name }] : [];
      }
      // There is no dedicated SDO mailbox: staff alerts go to every active employee account.
      const employees = await db.employee_accounts.findMany({
        where: { is_active: true },
        select: { employee_email: true, first_name: true },
        orderBy: { employee_id: 'asc' },
      });
      return employees.map((employee) => ({ email: employee.employee_email, firstName: employee.first_name }));
    },

    async markResult(notificationId, status, at) {
      // Only a row that is still pending is touched, so two overlapping passes cannot overwrite each other.
      await db.notifications.updateMany({
        where: { notification_id: notificationId, email_status: 'pending' },
        data: { email_status: status, date_email_sent: status === 'sent' ? at : null },
      });
    },

    async failOlderThan(cutoff) {
      const result = await db.notifications.updateMany({
        where: { email_status: 'pending', date_created: { lt: cutoff } },
        data: { email_status: 'failed' },
      });
      return result.count;
    },
  };
}
