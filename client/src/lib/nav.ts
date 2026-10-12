import type { AccountRole } from '@shared/types';

/** Which count a navigation entry shows as a badge (see useNavBadges). */
export type BadgeKey = 'inbox' | 'cases' | 'students';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  badge?: BadgeKey;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const STUDENT_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
      { to: '/inbox', label: 'Inbox', icon: 'inbox', badge: 'inbox' },
    ],
  },
  {
    label: 'My record',
    items: [
      { to: '/violations', label: 'My violations', icon: 'gavel' },
      { to: '/sanctions', label: 'My sanctions', icon: 'assignment' },
      { to: '/appointments', label: 'Appointments', icon: 'event' },
      { to: '/clearance', label: 'Clearance', icon: 'verified_user' },
    ],
  },
  {
    label: 'Resources',
    items: [{ to: '/handbook', label: 'Student handbook', icon: 'menu_book' }],
  },
];

const STAFF_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
      { to: '/inbox', label: 'Inbox', icon: 'inbox', badge: 'inbox' },
    ],
  },
  {
    label: 'Create',
    items: [
      { to: '/record', label: 'Record violation', icon: 'add_circle' },
      { to: '/appointments/new', label: 'Make appointment', icon: 'edit_calendar' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/cases', label: 'Cases', icon: 'gavel', badge: 'cases' },
      { to: '/students', label: 'Students', icon: 'school', badge: 'students' },
      { to: '/appointments', label: 'Appointments', icon: 'event', end: true },
      { to: '/clearance', label: 'Clearance', icon: 'verified_user' },
    ],
  },
  {
    label: 'Handbook',
    items: [
      { to: '/handbook', label: 'Violations', icon: 'menu_book', end: true },
      { to: '/handbook?tab=templates', label: 'Sanction templates', icon: 'folder_copy' },
    ],
  },
];

export function navGroups(role: AccountRole): NavGroup[] {
  return role === 'staff' ? STAFF_GROUPS : STUDENT_GROUPS;
}

/** The five tabs of the phone bottom bar (the sixth place, More, opens the drawer with every group). */
export function phoneTabs(role: AccountRole): NavItem[] {
  const groups = navGroups(role);
  const find = (to: string): NavItem => {
    for (const group of groups) {
      const hit = group.items.find((item) => item.to === to);
      if (hit) return hit;
    }
    throw new Error(`Unknown nav target ${to}`);
  };
  return role === 'staff'
    ? [find('/'), find('/cases'), find('/students'), find('/appointments')]
    : [find('/'), find('/violations'), find('/sanctions'), find('/appointments')];
}

const TITLES: Array<[RegExp, string, string]> = [
  [/^\/$/, 'Overview', 'Dashboard'],
  [/^\/inbox$/, 'Overview', 'Inbox'],
  [/^\/record$/, 'Create', 'Record violation'],
  [/^\/appointments\/new$/, 'Create', 'Make appointment'],
  [/^\/cases\/\d+$/, 'Manage', 'Case'],
  [/^\/cases$/, 'Manage', 'Cases'],
  [/^\/students\/[^/]+$/, 'Manage', 'Students'],
  [/^\/students$/, 'Manage', 'Students'],
  [/^\/appointments(\/\d+)?$/, 'Manage', 'Appointments'],
  [/^\/clearance(\/slip)?$/, 'Manage', 'Clearance'],
  [/^\/handbook$/, 'Handbook', 'Violations'],
  [/^\/account\/password$/, 'Account', 'Change password'],
  [/^\/account$/, 'Account', 'Account details'],
  [/^\/violations\/\d+$/, 'My record', 'Violation'],
  [/^\/violations$/, 'My record', 'My violations'],
  [/^\/sanctions$/, 'My record', 'My sanctions'],
];

/** `Staff > Dashboard`: the role, then the page (and its group for the staff pages that have one). */
export function breadcrumb(role: AccountRole, pathname: string, search = ''): string[] {
  const root = role === 'staff' ? 'Staff' : 'Student';
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const hit = TITLES.find(([pattern]) => pattern.test(path));
  if (!hit) return [root, 'Page not found'];
  const [, group, title] = hit;
  if (path === '/handbook' && new URLSearchParams(search).get('tab') === 'templates') {
    return role === 'staff' ? [root, 'Handbook', 'Sanction templates'] : [root, 'Student handbook'];
  }
  if (role === 'student') return path === '/handbook' ? [root, 'Student handbook'] : [root, title];
  return group === 'Overview' ? [root, title] : [root, group, title];
}

export function initials(firstName: string, lastName: string): string {
  const letter = (text: string) => text.trim().charAt(0).toUpperCase();
  return `${letter(firstName)}${letter(lastName)}` || '?';
}
