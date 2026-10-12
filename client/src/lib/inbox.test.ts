import { describe, expect, test } from 'vitest';
import type { NotificationView } from '@shared/types';
import { categoryCounts, filterInbox, inboxCategory, pageOf } from './inbox';

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
  const items = [n(1, 'case'), n(2, 'sanction', true), n(3, 'appt'), n(4, 'newviol', true), n(5, 'clr'), n(6, 'account')];

  test('categories', () => {
    expect(inboxCategory('esc')).toBe('violations');
    expect(inboxCategory('sanction')).toBe('sanctions');
    expect(inboxCategory('appt')).toBe('appointments');
  });

  test('filter by chip and unread', () => {
    expect(filterInbox(items, 'violations', false).map((i) => i.id)).toEqual([1, 4]);
    expect(filterInbox(items, 'violations', true).map((i) => i.id)).toEqual([1]);
    expect(filterInbox(items, 'all', true).map((i) => i.id)).toEqual([1, 3, 5, 6]);
  });

  test('counts cover the whole list', () => {
    expect(categoryCounts(items)).toEqual({ all: 6, violations: 2, sanctions: 1, appointments: 1, clearance: 1, account: 1 });
  });

  test('paging clamps the page', () => {
    const many = Array.from({ length: 20 }, (_, i) => i);
    expect(pageOf(many, 1, 8)).toMatchObject({ pages: 3, page: 1 });
    expect(pageOf(many, 3, 8).rows).toEqual([16, 17, 18, 19]);
    expect(pageOf(many, 99, 8).page).toBe(3);
    expect(pageOf([], 1)).toEqual({ rows: [], pages: 1, page: 1 });
  });
});
