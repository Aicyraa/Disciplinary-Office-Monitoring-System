import { NavLink, Outlet } from 'react-router-dom';
import type { AccountRole } from '../../../shared/types';
import { useAuth } from '../auth/AuthContext';
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

// Staff pages arrive in later build steps; until then staff have a landing page and the handbook.
const STAFF_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/handbook', label: 'Handbook', icon: 'menu_book' },
];

export function navFor(role: AccountRole): NavItem[] {
  return role === 'staff' ? STAFF_NAV : STUDENT_NAV;
}

const linkBase = 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium';

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

export function Shell() {
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
          <span className="ml-auto text-sm text-muted">
            {user.firstName} {user.lastName}
            <span className="ml-2 rounded bg-page px-1.5 py-0.5 text-xs font-medium text-ink">
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
