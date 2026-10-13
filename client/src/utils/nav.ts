import type { AccountRole } from '@shared/types';

/** Which count a navigation entry shows as a badge (see useNavBadges). */
export type BadgeKey = 'inbox' | 'cases' | 'students';

export interface NavItem {
  to: string;
  label: string;
  /** The phone tab-bar label when it differs ("Home", "Schedule"). */
  short?: string;
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
      { to: '/', label: 'Dashboard', short: 'Home', icon: 'space_dashboard', end: true },
      { to: '/inbox', label: 'Inbox', icon: 'inbox', badge: 'inbox' },
    ],
  },
  {
    label: 'My record',
    items: [
      { to: '/violations', label: 'My Violations', short: 'Violations', icon: 'report' },
      { to: '/sanctions', label: 'My Sanctions', short: 'Sanctions', icon: 'assignment_late' },
      { to: '/appointments', label: 'Appointments', short: 'Schedule', icon: 'calendar_month' },
      { to: '/clearance', label: 'Clearance', icon: 'task_alt' },
    ],
  },
  {
    label: 'Resources',
    items: [{ to: '/handbook', label: 'Student Handbook', icon: 'menu_book' }],
  },
];

const STAFF_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', short: 'Home', icon: 'space_dashboard', end: true },
      { to: '/inbox', label: 'Inbox', icon: 'inbox', badge: 'inbox' },
    ],
  },
  {
    label: 'Create',
    items: [
      { to: '/record', label: 'Record violation', icon: 'add_circle' },
      { to: '/appointments/new', label: 'Make appointment', icon: 'edit_calendar' },
      { to: '/handbook/new', label: 'Add violation', icon: 'post_add' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/cases', label: 'Cases', icon: 'gavel', badge: 'cases' },
      { to: '/students', label: 'Students', icon: 'school', badge: 'students' },
      { to: '/notices', label: 'Notices', icon: 'campaign' },
      { to: '/appointments', label: 'Appointments', short: 'Schedule', icon: 'calendar_month', end: true },
      { to: '/clearance', label: 'Clearance', icon: 'task_alt' },
    ],
  },
  {
    label: 'Handbook',
    items: [
      { to: '/handbook', label: 'Violations', icon: 'menu_book' },
      { to: '/handbook?tab=templates', label: 'Sanction templates', icon: 'folder_managed' },
    ],
  },
];

export function navGroups(role: AccountRole): NavGroup[] {
  return role === 'staff' ? STAFF_GROUPS : STUDENT_GROUPS;
}

/** The four tabs of the phone bottom bar, with their short labels (the fifth place, More, opens the drawer). */
export function phoneTabs(role: AccountRole): NavItem[] {
  const groups = navGroups(role);
  const find = (to: string): NavItem => {
    for (const group of groups) {
      const hit = group.items.find((item) => item.to === to);
      if (hit) return { ...hit, label: hit.short ?? hit.label };
    }
    throw new Error(`Unknown nav target ${to}`);
  };
  return role === 'staff'
    ? [find('/'), find('/cases'), find('/students'), find('/appointments')]
    : [find('/'), find('/violations'), find('/sanctions'), find('/appointments')];
}

/** Page titles for the breadcrumb, per role. Detail routes keep their list's title (deck W17: "Staff › Cases"). */
const TITLES: Array<[RegExp, string, string?]> = [
  [/^\/$/, 'Dashboard'],
  [/^\/inbox$/, 'Inbox'],
  [/^\/record$/, 'Record violation'],
  [/^\/appointments\/new$/, 'Make appointment'],
  [/^\/cases(\/\d+)?$/, 'Cases'],
  [/^\/students(\/[^/]+)?$/, 'Students'],
  [/^\/appointments(\/\d+)?$/, 'Appointments'],
  [/^\/notices$/, 'Notices'],
  [/^\/clearance(\/slip|\/[^/]+)?$/, 'Clearance'],
  [/^\/handbook\/new$/, 'Add violation'],
  [/^\/handbook(\/\d+)?$/, 'Violations', 'Student Handbook'],
  [/^\/account\/password$/, 'Change password'],
  [/^\/account$/, 'Account details'],
  [/^\/violations(\/\d+)?$/, 'My Violations'],
  [/^\/sanctions(\/\d+)?$/, 'My Sanctions'],
];

/** `Staff › Cases`: the portal, then the page title (deck src 315). */
export function breadcrumb(role: AccountRole, pathname: string, search = ''): string[] {
  const root = role === 'staff' ? 'Staff' : 'Student';
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (role === 'staff' && path === '/handbook' && new URLSearchParams(search).get('tab') === 'templates') {
    return [root, 'Sanction templates'];
  }
  const hit = TITLES.find(([pattern]) => pattern.test(path));
  if (!hit) return [root, 'Page not found'];
  const [, staffTitle, studentTitle] = hit;
  return [root, role === 'student' && studentTitle ? studentTitle : staffTitle];
}

export function initials(firstName: string, lastName: string): string {
  const letter = (text: string) => text.trim().charAt(0).toUpperCase();
  return `${letter(firstName)}${letter(lastName)}` || '?';
}
