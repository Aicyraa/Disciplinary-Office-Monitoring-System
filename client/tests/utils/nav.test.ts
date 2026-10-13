import { describe, expect, test } from 'vitest';
import { breadcrumb, initials, navGroups, phoneTabs } from '@/utils/nav';

describe('navGroups', () => {
  test('staff groups follow the deck: Overview, Create, Manage, Handbook', () => {
    expect(navGroups('staff').map((group) => group.label)).toEqual(['Overview', 'Create', 'Manage', 'Handbook']);
  });

  test('student groups follow the deck: Overview, My record, Resources', () => {
    expect(navGroups('student').map((group) => group.label)).toEqual(['Overview', 'My record', 'Resources']);
  });

  test('every target is unique inside a role', () => {
    for (const role of ['staff', 'student'] as const) {
      const targets = navGroups(role).flatMap((group) => group.items.map((item) => item.to));
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  test('badges: Inbox for both roles, Cases for staff', () => {
    const badges = (role: 'staff' | 'student') =>
      navGroups(role).flatMap((group) => group.items.filter((item) => item.badge).map((item) => item.badge));
    expect(badges('staff')).toEqual(['inbox', 'cases', 'students']);
    expect(badges('student')).toEqual(['inbox']);
  });
});

describe('phoneTabs', () => {
  test('are real destinations of the same role and at most four (the fifth place is More)', () => {
    for (const role of ['staff', 'student'] as const) {
      const all = navGroups(role).flatMap((group) => group.items.map((item) => item.to));
      const tabs = phoneTabs(role);
      expect(tabs.length).toBeLessThanOrEqual(4);
      for (const tab of tabs) expect(all).toContain(tab.to);
    }
  });
});

describe('breadcrumb', () => {
  test('staff dashboard and grouped pages', () => {
    expect(breadcrumb('staff', '/')).toEqual(['Staff', 'Dashboard']);
    expect(breadcrumb('staff', '/cases')).toEqual(['Staff', 'Manage', 'Cases']);
    expect(breadcrumb('staff', '/cases/12')).toEqual(['Staff', 'Manage', 'Case']);
    expect(breadcrumb('staff', '/record')).toEqual(['Staff', 'Create', 'Record violation']);
    expect(breadcrumb('staff', '/students/2025-1030808')).toEqual(['Staff', 'Manage', 'Students']);
    expect(breadcrumb('staff', '/appointments/4')).toEqual(['Staff', 'Manage', 'Appointments']);
    expect(breadcrumb('staff', '/handbook/new')).toEqual(['Staff', 'Create', 'Add violation']);
    expect(breadcrumb('staff', '/notices')).toEqual(['Staff', 'Manage', 'Notices']);
    expect(breadcrumb('staff', '/handbook/12')).toEqual(['Staff', 'Handbook', 'Violations']);
  });

  test('the handbook templates tab has its own crumb for staff', () => {
    expect(breadcrumb('staff', '/handbook', '?tab=templates')).toEqual(['Staff', 'Handbook', 'Sanction templates']);
    expect(breadcrumb('staff', '/handbook')).toEqual(['Staff', 'Handbook', 'Violations']);
  });

  test('student pages have the role then the page', () => {
    expect(breadcrumb('student', '/')).toEqual(['Student', 'Dashboard']);
    expect(breadcrumb('student', '/violations/3')).toEqual(['Student', 'Violation']);
    expect(breadcrumb('student', '/sanctions/7')).toEqual(['Student', 'My sanctions']);
    expect(breadcrumb('student', '/handbook')).toEqual(['Student', 'Student handbook']);
  });

  test('unknown paths and a trailing slash', () => {
    expect(breadcrumb('staff', '/nope')).toEqual(['Staff', 'Page not found']);
    expect(breadcrumb('staff', '/cases/')).toEqual(['Staff', 'Manage', 'Cases']);
  });
});

describe('initials', () => {
  test('two letters, upper case, and a fallback', () => {
    expect(initials('andrea', 'marcelo')).toBe('AM');
    expect(initials('', '')).toBe('?');
  });
});
