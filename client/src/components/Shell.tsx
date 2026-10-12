import { Link, NavLink, Outlet } from 'react-router-dom';
import type { AccountRole } from '@shared/types';
import { useAuth } from '../auth/AuthContext';
import { UnreadProvider, badgeText, useUnread } from '../notifications/UnreadContext';
import { Icon } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

const STUDENT_NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/inbox', label: 'Inbox', icon: 'inbox' },
  { to: '/violations', label: 'My violations', icon: 'gavel' },
  { to: '/sanctions', label: 'My sanctions', icon: 'assignment' },
  { to: '/appointments', label: 'Appointments', icon: 'event' },
  { to: '/clearance', label: 'Clearance', icon: 'verified_user' },
  { to: '/handbook', label: 'Handbook', icon: 'menu_book' },
];

// Staff pages arrive step by step; the rest of the ten staff pages follow in later build steps.
const STAFF_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/inbox', label: 'Inbox', icon: 'inbox' },
  { to: '/record', label: 'Record violation', icon: 'edit_note' },
  { to: '/cases', label: 'Cases', icon: 'folder_open' },
  { to: '/appointments', label: 'Appointments', icon: 'event' },
  { to: '/clearance', label: 'Clearance', icon: 'verified_user' },
  { to: '/handbook', label: 'Handbook', icon: 'menu_book' },
];

export function navFor(role: AccountRole): NavItem[] {
  return role === 'staff' ? STAFF_NAV : STUDENT_NAV;
}

// The sidebar is dark, so its focus ring is white (the default primary ring would be invisible on it).
const linkBase =
  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-white';

function SideLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      className={({ isActive }) =>
        `${linkBase} ${isActive ? 'bg-primary-active text-white' : 'text-white/85 hover:bg-white/10'}`
      }
    >
      <Icon name={item.icon} />
      {/* Icon rail between 720 and 1100 px: labels only in the full sidebar. */}
      <span className="hidden full:inline">{item.label}</span>
    </NavLink>
  );
}

function TabLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 px-2 py-2 text-[11px] font-medium ${
          isActive ? 'text-primary' : 'text-muted'
        }`
      }
    >
      <Icon name={item.icon} />
      <span className="whitespace-nowrap">{item.label}</span>
    </NavLink>
  );
}

/** The bell in the top bar: a link to the inbox with the unread count. */
function Bell() {
  const { unreadCount } = useUnread();
  const text = badgeText(unreadCount);
  return (
    <Link
      to="/inbox"
      aria-label={text === null ? 'Inbox, no unread notifications' : `Inbox, ${unreadCount} unread`}
      className="relative inline-flex items-center rounded-md p-1 text-ink hover:bg-page"
    >
      <Icon name="notifications" />
      {text === null ? null : (
        <span className="absolute -top-1 -right-1 min-w-5 rounded-full bg-danger px-1 text-center text-[11px] leading-5 font-semibold text-white">
          {text}
        </span>
      )}
    </Link>
  );
}

/** "You have N unread" after sign-in. A status message, so screen readers announce it without taking focus. */
function UnreadToast() {
  const { toast, dismissToast } = useUnread();
  if (toast === null) return null;
  return (
    <div
      role="status"
      className="fixed top-3 right-3 z-20 flex max-w-sm items-center gap-3 rounded-lg border border-line-strong bg-white px-4 py-3 text-sm shadow-lg"
    >
      <Icon name="notifications" className="text-primary" />
      <span className="text-ink">{toast}</span>
      <Link to="/inbox" onClick={dismissToast} className="font-medium text-primary underline">
        View
      </Link>
      <button type="button" onClick={dismissToast} aria-label="Dismiss" className="text-muted hover:text-ink">
        <Icon name="close" />
      </button>
    </div>
  );
}

export function Shell() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  return (
    <UnreadProvider role={state.user.role}>
      <ShellFrame />
    </UnreadProvider>
  );
}

function ShellFrame() {
  const { state, signOut } = useAuth();
  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const items = navFor(user.role);

  return (
    <div className="min-h-screen rail:flex">
      <aside className="hidden bg-primary text-white rail:sticky rail:top-0 rail:flex rail:h-screen rail:w-16 rail:flex-col rail:p-2 full:w-60 full:p-3">
        <div className="mb-4 flex items-center gap-3 px-2 py-3">
          <Icon name="shield_person" className="text-gold" />
          <span className="hidden text-sm leading-tight font-bold full:inline">
            SDO Portal
            <span className="block text-xs font-normal text-white/70">NU Fairview</span>
          </span>
        </div>
        <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <SideLink key={item.to} item={item} />
          ))}
        </nav>
        <button type="button" onClick={() => void signOut()} className={`${linkBase} text-white/85 hover:bg-white/10`} title="Sign out">
          <Icon name="logout" />
          <span className="hidden full:inline">Sign out</span>
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
          <span className="text-sm font-semibold text-ink rail:hidden">SDO Portal</span>
          <span className="ml-auto flex items-center gap-2 text-sm text-muted">
            <Bell />
            {user.firstName} {user.lastName}
            <span className="rounded bg-page px-1.5 py-0.5 text-xs font-medium text-ink">
              {user.role === 'staff' ? 'Staff' : user.id}
            </span>
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-page rail:hidden"
          >
            Sign out
          </button>
        </div>
        <UnreadToast />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 rail:pb-6">
          <Outlet />
        </main>
      </div>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 flex overflow-x-auto border-t border-line bg-white rail:hidden"
      >
        {items.map((item) => (
          <TabLink key={item.to} item={item} />
        ))}
      </nav>
    </div>
  );
}
