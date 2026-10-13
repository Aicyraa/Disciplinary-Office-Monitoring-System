import { describe, expect, test } from 'vitest';
import { breadcrumb, initials, navGroups, phoneTabs } from '@/utils/nav';

describe('navGroups (deck src 2579)', () => {
  test('staff groups: Overview, Create, Manage, Handbook', () => {
    expect(navGroups('staff').map((group) => group.label)).toEqual(['Overview', 'Create', 'Manage', 'Handbook']);
  });

  test('student groups: Overview, My record, Resources', () => {
    expect(navGroups('student').map((group) => group.label)).toEqual(['Overview', 'My record', 'Resources']);
  });

  test('labels and icons follow the deck', () => {
    const items = (role: 'staff' | 'student') => navGroups(role).flatMap((group) => group.items.map((item) => [item.label, item.icon]));
    expect(items('student')).toEqual([
      ['Dashboard', 'space_dashboard'],
      ['Inbox', 'inbox'],
      ['My Violations', 'report'],
      ['My Sanctions', 'assignment_late'],
      ['Appointments', 'calendar_month'],
      ['Clearance', 'task_alt'],
      ['Student Handbook', 'menu_book'],
    ]);
    expect(items('staff')).toEqual([
      ['Dashboard', 'space_dashboard'],
      ['Inbox', 'inbox'],
      ['Record violation', 'add_circle'],
      ['Make appointment', 'edit_calendar'],
      ['Add violation', 'post_add'],
      ['Cases', 'gavel'],
      ['Students', 'school'],
      ['Notices', 'campaign'],
      ['Appointments', 'calendar_month'],
      ['Clearance', 'task_alt'],
      ['Violations', 'menu_book'],
      ['Sanction templates', 'folder_managed'],
    ]);
  });

  test('every target is unique inside a role', () => {
    for (const role of ['staff', 'student'] as const) {
      const targets = navGroups(role).flatMap((group) => group.items.map((item) => item.to));
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  test('badges: Inbox for both roles, Cases and Students for staff', () => {
    const badges = (role: 'staff' | 'student') =>
      navGroups(role).flatMap((group) => group.items.filter((item) => item.badge).map((item) => item.badge));
    expect(badges('staff')).toEqual(['inbox', 'cases', 'students']);
    expect(badges('student')).toEqual(['inbox']);
  });
});

describe('phoneTabs (deck src 2588)', () => {
  test('four tabs with the short labels; the fifth place is More', () => {
    expect(phoneTabs('staff').map((tab) => [tab.to, tab.label])).toEqual([
      ['/', 'Home'],
      ['/cases', 'Cases'],
      ['/students', 'Students'],
      ['/appointments', 'Schedule'],
    ]);
    expect(phoneTabs('student').map((tab) => [tab.to, tab.label])).toEqual([
      ['/', 'Home'],
      ['/violations', 'Violations'],
      ['/sanctions', 'Sanctions'],
      ['/appointments', 'Schedule'],
    ]);
  });

  test('tabs keep the badge of their nav entry', () => {
    expect(phoneTabs('staff').map((tab) => tab.badge)).toEqual([undefined, 'cases', 'students', undefined]);
  });
});

describe('breadcrumb: the role, then the page title (deck src 315)', () => {
  test('staff pages', () => {
    expect(breadcrumb('staff', '/')).toEqual(['Staff', 'Dashboard']);
    expect(breadcrumb('staff', '/cases')).toEqual(['Staff', 'Cases']);
    expect(breadcrumb('staff', '/cases/12')).toEqual(['Staff', 'Cases']);
    expect(breadcrumb('staff', '/record')).toEqual(['Staff', 'Record violation']);
    expect(breadcrumb('staff', '/students/2025-1030808')).toEqual(['Staff', 'Students']);
    expect(breadcrumb('staff', '/appointments/4')).toEqual(['Staff', 'Appointments']);
    expect(breadcrumb('staff', '/appointments/new')).toEqual(['Staff', 'Make appointment']);
    expect(breadcrumb('staff', '/appointments/12/edit')).toEqual(['Staff', 'Edit appointment']);
    expect(breadcrumb('staff', '/handbook/new')).toEqual(['Staff', 'Add violation']);
    expect(breadcrumb('staff', '/notices')).toEqual(['Staff', 'Notices']);
    expect(breadcrumb('staff', '/handbook/12')).toEqual(['Staff', 'Violations']);
    expect(breadcrumb('staff', '/sanction-templates/3')).toEqual(['Staff', 'Sanction templates']);
    expect(breadcrumb('staff', '/clearance/3')).toEqual(['Staff', 'Clearance']);
  });

  test('student pages', () => {
    expect(breadcrumb('student', '/')).toEqual(['Student', 'Dashboard']);
    expect(breadcrumb('student', '/violations/3')).toEqual(['Student', 'My Violations']);
    expect(breadcrumb('student', '/sanctions/7')).toEqual(['Student', 'My Sanctions']);
    expect(breadcrumb('student', '/handbook')).toEqual(['Student', 'Student Handbook']);
    expect(breadcrumb('student', '/handbook/4')).toEqual(['Student', 'Student Handbook']);
  });

  test('unknown paths and a trailing slash', () => {
    expect(breadcrumb('staff', '/nope')).toEqual(['Staff', 'Page not found']);
    expect(breadcrumb('staff', '/cases/')).toEqual(['Staff', 'Cases']);
  });
});

describe('initials', () => {
  test('two letters, upper case, and a fallback', () => {
    expect(initials('andrea', 'marcelo')).toBe('AM');
    expect(initials('', '')).toBe('?');
  });
});
