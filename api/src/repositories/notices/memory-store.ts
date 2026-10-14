import type { MemoryNotifications } from '../notifications/memory.js';
import type { NoticeRecord, NoticeStore } from './types.js';

interface StoredNotice extends NoticeRecord {
  employeeId: string;
}

/** In-memory notice store for tests: it writes the student notifications into the same fake inbox the API reads. */
export function createMemoryNoticeStore({
  notifications,
  students,
  staffNames = {},
}: {
  notifications: MemoryNotifications;
  /** The active student ids that receive a notice. */
  students: string[];
  staffNames?: Record<string, string>;
}): NoticeStore & { readonly notices: StoredNotice[] } {
  const notices: StoredNotice[] = [];
  let nextId = 1;

  return {
    notices,
    async create(input) {
      const noticeId = nextId++;
      notices.push({
        noticeId,
        title: input.title,
        message: input.message,
        instructions: input.instructions,
        expiresOn: input.expiresOn,
        createdBy: staffNames[input.employeeId] ?? input.employeeId,
        employeeId: input.employeeId,
        dateCreated: input.date,
        dateUpdated: input.date,
        recipients: students.length,
      });
      for (const studentId of students) {
        await notifications.add({
          recipient: 'student',
          studentId,
          kind: 'notice',
          title: input.title,
          message: input.inboxMessage,
          linkType: 'inbox',
          linkId: noticeId,
          idempotencyKey: `notice:${noticeId}:${studentId}`,
        });
      }
      return { noticeId, recipients: students.length };
    },

    async update(noticeId, patch) {
      const found = notices.find((notice) => notice.noticeId === noticeId);
      if (!found) return false;
      found.title = patch.title;
      found.message = patch.message;
      found.instructions = patch.instructions;
      found.expiresOn = patch.expiresOn;
      found.dateUpdated = patch.date;
      for (const row of notifications.rows) {
        if (row.kind === 'notice' && row.linkId === noticeId) {
          row.title = patch.title;
          row.message = patch.inboxMessage;
        }
      }
      return true;
    },

    async remove(noticeId) {
      const index = notices.findIndex((notice) => notice.noticeId === noticeId);
      if (index < 0) return false;
      notices.splice(index, 1);
      for (let i = notifications.rows.length - 1; i >= 0; i -= 1) {
        const row = notifications.rows[i];
        if (row.kind === 'notice' && row.linkId === noticeId) notifications.rows.splice(i, 1);
      }
      return true;
    },

    async list() {
      return [...notices]
        .sort((a, b) => b.noticeId - a.noticeId)
        .map((notice) => {
          const { employeeId, ...record } = notice;
          void employeeId;
          return record;
        });
    },
  };
}
