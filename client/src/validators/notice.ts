/** Staff Notices form checks (UI-POLISH-SPEC 5.13). The API checks every rule again. */

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
