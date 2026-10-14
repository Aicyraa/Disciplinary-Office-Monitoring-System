import type { PrismaClient } from '../../../generated/prisma/client.js';
import type { NoticeStore } from './types.js';

type Db = Pick<PrismaClient, 'notices' | 'notifications' | 'student_accounts' | '$transaction'>;

const asDate = (iso: string | null): Date | null => (iso === null ? null : new Date(`${iso}T00:00:00Z`));
const asDay = (date: Date | null): string | null => (date === null ? null : date.toISOString().slice(0, 10));

/**
 * Prisma-backed notices. Publishing writes the notice and one `notice` notification per active student in one
 * transaction (idempotency key `notice:<id>:<studentId>`); the delivery sweep then emails them like any other.
 */
export function createPrismaNoticeStore(db: Db): NoticeStore {
  return {
    async create(input) {
      return db.$transaction(async (tx) => {
        const notice = await tx.notices.create({
          data: {
            title: input.title,
            message: input.message,
            instructions: input.instructions,
            expires_on: asDate(input.expiresOn),
            created_by_employee_id: input.employeeId,
            date_created: input.date,
            date_updated: input.date,
          },
          select: { notice_id: true },
        });
        const students = await tx.student_accounts.findMany({ where: { is_active: true }, select: { student_id: true } });
        if (students.length > 0) {
          await tx.notifications.createMany({
            data: students.map((student) => ({
              recipient_type: 'student',
              student_id: student.student_id,
              kind: 'notice',
              title: input.title,
              message: input.inboxMessage,
              link_type: 'inbox',
              link_id: notice.notice_id,
              idempotency_key: `notice:${notice.notice_id}:${student.student_id}`,
            })),
            skipDuplicates: true,
          });
        }
        return { noticeId: notice.notice_id, recipients: students.length };
      });
    },

    async update(noticeId, patch) {
      return db.$transaction(async (tx) => {
        const result = await tx.notices.updateMany({
          where: { notice_id: noticeId },
          data: {
            title: patch.title,
            message: patch.message,
            instructions: patch.instructions,
            expires_on: asDate(patch.expiresOn),
            date_updated: patch.date,
          },
        });
        if (result.count === 0) return false;
        await tx.notifications.updateMany({
          where: { kind: 'notice', link_id: noticeId },
          data: { title: patch.title, message: patch.inboxMessage },
        });
        return true;
      });
    },

    async remove(noticeId) {
      return db.$transaction(async (tx) => {
        const found = await tx.notices.count({ where: { notice_id: noticeId } });
        if (found === 0) return false;
        await tx.notifications.deleteMany({ where: { kind: 'notice', link_id: noticeId } });
        await tx.notices.delete({ where: { notice_id: noticeId } });
        return true;
      });
    },

    async list() {
      const rows = await db.notices.findMany({
        orderBy: { notice_id: 'desc' },
        include: { employee_accounts: { select: { first_name: true, last_name: true } } },
      });
      const counts = await db.notifications.groupBy({
        by: ['link_id'],
        where: { kind: 'notice', link_id: { in: rows.map((row) => row.notice_id) } },
        _count: { _all: true },
      });
      const recipients = new Map(counts.map((group) => [group.link_id, group._count._all]));
      return rows.map((row) => ({
        noticeId: row.notice_id,
        title: row.title,
        message: row.message,
        instructions: row.instructions,
        expiresOn: asDay(row.expires_on),
        createdBy: `${row.employee_accounts.first_name} ${row.employee_accounts.last_name}`,
        dateCreated: row.date_created,
        dateUpdated: row.date_updated,
        recipients: recipients.get(row.notice_id) ?? 0,
      }));
    },
  };
}
