import type { NoticeView } from '@shared/types';

/** Staff Notices (source src 1609 to 1668, 3281 to 3312; UI-POLISH-SPEC 5.13). The API checks every rule again. */

export interface NoticeDraft {
  title: string;
  message: string;
  instructions: string;
  expiresOn: string;
}

export type NoticeErrors = Partial<Record<keyof NoticeDraft, string>>;

/** The API's limits (MAX_NOTICE_TITLE 120, MAX_NOTICE_TEXT 1000). */
const TITLE_MAX = 120;
const TEXT_MAX = 1000;

export function noticeErrors(draft: NoticeDraft, today: string): NoticeErrors {
  const errors: NoticeErrors = {};
  const title = draft.title.trim();
  if (!title) errors.title = 'Enter a title.';
  else if (title.length > TITLE_MAX) errors.title = `Use up to ${TITLE_MAX} characters.`;
  const message = draft.message.trim();
  if (!message) errors.message = 'Enter the message students should read.';
  else if (message.length > TEXT_MAX) errors.message = `Use up to ${TEXT_MAX} characters.`;
  if (draft.instructions.trim().length > TEXT_MAX) errors.instructions = `Use up to ${TEXT_MAX} characters.`;
  if (draft.expiresOn && draft.expiresOn < today) errors.expiresOn = 'Choose today or a later date, or leave it blank.';
  return errors;
}

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
