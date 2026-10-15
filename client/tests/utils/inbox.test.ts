import { describe, expect, test } from 'vitest';
import type { NotificationView } from '@shared/types';
import { categoryCounts, filterInbox, inboxCategory, inboxChips, inboxEmptyText, INBOX_PAGE_SIZE, openLabel, pageOf, splitNotice } from '@/utils/inbox';

const n = (id: number, kind: NotificationView['kind'], isRead = false): NotificationView => ({
  id,
  kind,
  title: `t${id}`,
  message: 'm',
  isRead,
  dateCreated: '2026-10-01T00:00:00Z',
  href: null,
});

describe('inbox', () => {
  const items = [n(1, 'case'), n(2, 'sanction', true), n(3, 'appt'), n(4, 'newviol', true), n(5, 'clr'), n(6, 'account'), n(7, 'notice')];

  test('categories', () => {
    expect(inboxCategory('esc')).toBe('violations');
    expect(inboxCategory('sanction')).toBe('sanctions');
    expect(inboxCategory('appt')).toBe('appointments');
    expect(inboxCategory('notice')).toBe('notices');
  });

  test('filter by chip and unread', () => {
    expect(filterInbox(items, 'violations', false).map((i) => i.id)).toEqual([1, 4]);
    expect(filterInbox(items, 'violations', true).map((i) => i.id)).toEqual([1]);
    expect(filterInbox(items, 'all', true).map((i) => i.id)).toEqual([1, 3, 5, 6, 7]);
  });

  test('counts cover the whole list', () => {
    expect(categoryCounts(items)).toEqual({ all: 7, notices: 1, violations: 2, sanctions: 1, appointments: 1, clearance: 1, account: 1 });
  });

  test('paging clamps the page', () => {
    const many = Array.from({ length: 20 }, (_, i) => i);
    expect(pageOf(many, 1, 8)).toMatchObject({ pages: 3, page: 1 });
    expect(pageOf(many, 3, 8).rows).toEqual([16, 17, 18, 19]);
    expect(pageOf(many, 99, 8).page).toBe(3);
    expect(pageOf([], 1)).toEqual({ rows: [], pages: 1, page: 1 });
  });
});

describe('inbox page (deck W58 to W61, src 3300 to 3335)', () => {
  test('6 per page; the five deck chips always, Clearance and Account only when used', () => {
    expect(INBOX_PAGE_SIZE).toBe(6);
    expect(inboxChips([n(1, 'case')]).map((c) => [c.label, c.count])).toEqual([
      ['All', 1],
      ['Important notices', 0],
      ['Violations', 1],
      ['Sanctions', 0],
      ['Appointments', 0],
    ]);
    expect(inboxChips([n(1, 'clr')]).map((c) => c.label)).toContain('Clearance');
  });

  test('empty texts per chip and for unread only', () => {
    expect(inboxEmptyText('all', false)).toBe('No messages yet.');
    expect(inboxEmptyText('violations', true)).toBe('No unread messages here.');
    expect(inboxEmptyText('violations', false)).toBe('No violation updates.');
    expect(inboxEmptyText('sanctions', false)).toBe('No sanction updates.');
    expect(inboxEmptyText('appointments', false)).toBe('No appointment updates.');
    expect(inboxEmptyText('notices', false)).toBe('No important notices right now.');
  });

  test('the dialog button names what it opens', () => {
    expect(openLabel('/appointments/4')).toBe('Open appointment');
    expect(openLabel('/violations/2')).toBe('Open case');
    expect(openLabel('/cases/2?queue=all')).toBe('Open case');
    expect(openLabel('/sanctions/9')).toBe('Open sanction');
    expect(openLabel('/students/2023-1001230')).toBe('Open student record');
    expect(openLabel('/clearance')).toBe('Open clearance');
    expect(openLabel('/inbox')).toBeNull();
    expect(openLabel(null)).toBeNull();
  });

  test('a notice keeps its instructions apart (the API appends them as "What to do: …")', () => {
    expect(splitNotice('Bring your ID.\n\nWhat to do: Wear the full uniform.')).toEqual({ body: 'Bring your ID.', instructions: 'Wear the full uniform.' });
    expect(splitNotice('Just a message.')).toEqual({ body: 'Just a message.', instructions: null });
  });
});
