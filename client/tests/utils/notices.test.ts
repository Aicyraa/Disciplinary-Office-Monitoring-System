import { describe, expect, test } from 'vitest';
import type { NoticeView } from '@shared/types';
import { noticeFacts, noticeMeta, noticeToasts } from '@/utils/notices';
import { noticeErrors } from '@/validators/notice';

const ok = { title: 'Uniform week', message: 'Inspection Oct 12 to 17.', instructions: '', expiresOn: '' };
const TODAY = '2026-10-12';

const notice = (over: Partial<NoticeView> = {}): NoticeView => ({
  id: 1,
  title: 'Uniform inspection week',
  message: 'Inspection Oct 12 to 17.',
  instructions: null,
  expiresOn: '2026-10-17',
  expired: false,
  createdBy: 'Andrea Marcelo',
  dateCreated: '2026-10-05T00:00:00.000Z',
  dateUpdated: '2026-10-05T00:00:00.000Z',
  recipients: 1240,
  ...over,
});

describe('notice form (source src 3293 to 3296)', () => {
  test('a title and a message are enough', () => {
    expect(noticeErrors(ok, TODAY)).toEqual({});
  });

  test('inline messages per field, with the API limits', () => {
    expect(noticeErrors({ ...ok, title: ' ', message: '' }, TODAY)).toEqual({ title: 'Enter a title.', message: 'Enter the message students should read.' });
    expect(noticeErrors({ ...ok, title: 'x'.repeat(121) }, TODAY).title).toBe('Use up to 120 characters.');
    expect(noticeErrors({ ...ok, instructions: 'x'.repeat(1001) }, TODAY).instructions).toBe('Use up to 1000 characters.');
  });

  test('an end date must be today or later', () => {
    expect(noticeErrors({ ...ok, expiresOn: TODAY }, TODAY)).toEqual({});
    expect(noticeErrors({ ...ok, expiresOn: '2026-10-11' }, TODAY).expiresOn).toBe('Choose today or a later date, or leave it blank.');
  });
});

describe('notice list and detail (source src 3284 to 3288)', () => {
  test('row meta: published and until, or no end date', () => {
    expect(noticeMeta(notice())).toBe('Published Oct 5, 2026 · Until Oct 17, 2026');
    expect(noticeMeta(notice({ expiresOn: null }))).toBe('Published Oct 5, 2026 · No end date');
  });

  test('detail facts: published with time and author, visible until, reach, edited only when changed', () => {
    const facts = noticeFacts(notice());
    expect(facts.published).toBe('Oct 5, 2026 · 8:00 AM · Andrea Marcelo');
    expect(facts.until).toBe('Oct 17, 2026');
    expect(facts.reach).toBe('All students (1240), in the bell, the inbox and by school email');
    expect(facts.edited).toBeNull();
    expect(noticeFacts(notice({ dateUpdated: '2026-10-06T01:00:00.000Z', expiresOn: null }))).toMatchObject({ until: 'No end date', edited: 'Oct 6, 2026 · 9:00 AM' });
  });

  test('toasts', () => {
    expect(noticeToasts.published(1240)).toBe('Notice published to 1240 students.');
    expect(noticeToasts.updated).toBe('Notice updated. Students see the new version.');
    expect(noticeToasts.removed).toBe('Notice removed.');
  });
});
