import type { NoticeView } from '@shared/types';

const longDay = (day: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${day}T00:00:00Z`));
const manila = (iso: string, options: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', ...options }).format(new Date(iso));
const dateTime = (iso: string): string =>
  `${manila(iso, { month: 'short', day: 'numeric', year: 'numeric' })} · ${manila(iso, { hour: 'numeric', minute: '2-digit' })}`;

export function noticeMeta(notice: Pick<NoticeView, 'dateCreated' | 'expiresOn'>): string {
  const published = manila(notice.dateCreated, { month: 'short', day: 'numeric', year: 'numeric' });
  return `Published ${published} · ${notice.expiresOn ? `Until ${longDay(notice.expiresOn)}` : 'No end date'}`;
}

export function noticeFacts(notice: NoticeView): { published: string; until: string; reach: string; edited: string | null } {
  return {
    published: `${dateTime(notice.dateCreated)} · ${notice.createdBy}`,
    until: notice.expiresOn ? longDay(notice.expiresOn) : 'No end date',
    reach: `All students (${notice.recipients}), in the bell, the inbox and by school email`,
    edited: notice.dateUpdated !== notice.dateCreated ? dateTime(notice.dateUpdated) : null,
  };
}

export const noticeToasts = {
  published: (recipients: number) => `Notice published to ${recipients} students.`,
  updated: 'Notice updated. Students see the new version.',
  removed: 'Notice removed.',
};
