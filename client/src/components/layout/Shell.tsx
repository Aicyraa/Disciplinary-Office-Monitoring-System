import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import seal from '@/assets/seal.png';
import { breadcrumb, initials, navGroups, phoneTabs, type NavGroup, type NavItem } from '@/utils/nav';
import { UnreadProvider, badgeText, useUnread } from '@/context/UnreadContext';
import { useNavBadges } from '@/hooks/useNavBadges';
import { Icon } from '@/components/ui';

// The sidebar is dark, so its focus ring is white (the default primary ring would be invisible on it).
const linkBase =
  'relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-white';

function useBadgeCount() {
  const { unreadCount } = useUnread();
  const { state } = useAuth();
  const location = useLocation();
  const role = state.status === 'authenticated' ? state.user.role : 'student';
  const counts = useNavBadges(role, location.pathname);
  return (item: NavItem): number => {
    if (item.badge === 'inbox') return unreadCount;
    if (item.badge === 'cases') return counts.cases;
    if (item.badge === 'students') return counts.students;
    return 0;
  };
}

function CountBadge({ count, className = '' }: { count: number; className?: string }) {
  const text = badgeText(count);
  if (text === null) return null;
  return (
    <span
      className={`min-w-5 rounded-full bg-gold px-1.5 text-center text-[11px] leading-5 font-bold text-ink ${className}`}
      aria-label={`${count} waiting`}
    >
      {text}
    </span>
  );
}

function SideLink({ item, count }: { item: NavItem; count: number }) {
  const location = useLocation();
  // `/handbook?tab=templates` and `/handbook` share a path; the query string decides which one is current.
  const [path, query] = item.to.split('?');
  const wantsTemplates = query === 'tab=templates';
  const onTemplates = new URLSearchParams(location.search).get('tab') === 'templates';
  const forced =
    path === '/handbook' ? (wantsTemplates ? onTemplates : !onTemplates && location.pathname !== '/handbook/new') : undefined;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      className={({ isActive }) => {
        const active = forced === undefined ? isActive : isActive && forced;
        return `${linkBase} ${active ? 'bg-primary-active text-white' : 'text-white/85 hover:bg-white/10'}`;
      }}
    >
      <Icon name={item.icon} />
      <span className="hidden flex-1 full:inline">{item.label}</span>
      <CountBadge count={count} className="hidden full:inline-block" />
      {badgeText(count) === null ? null : (
        <span aria-hidden="true" className="absolute top-1 right-1 size-2 rounded-full bg-gold full:hidden" />
      )}
    </NavLink>
  );
}

function Sidebar({ groups, countFor, role }: { groups: NavGroup[]; countFor: (item: NavItem) => number; role: 'staff' | 'student' }) {
  return (
    <aside className="hidden bg-primary text-white print:hidden rail:sticky rail:top-0 rail:flex rail:h-screen rail:w-16 rail:flex-col rail:overflow-y-auto rail:p-2 full:w-60 full:p-3">
      <div className="mb-3 flex items-center gap-3 border-b border-white/15 px-1 py-3">
        <img src={seal} alt="" className="size-9 shrink-0 rounded-full bg-white object-contain" />
        <span className="hidden text-sm leading-tight font-bold full:inline">
          NU FAIRVIEW
          <span className="block text-[11px] font-normal text-white/75">
            Student Discipline Office · {role === 'staff' ? 'Staff' : 'Student'}
          </span>
        </span>
      </div>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="mb-1 hidden px-3 text-[11px] font-semibold tracking-wide text-white/60 uppercase full:block">{group.label}</p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
                <SideLink key={item.to} item={item} count={countFor(item)} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
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
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-ink hover:bg-page"
    >
      <Icon name="notifications" />
      {text === null ? null : (
        <span className="absolute top-1 right-1 min-w-5 rounded-full bg-danger px-1 text-center text-[11px] leading-5 font-semibold text-white">
          {text}
        </span>
      )}
    </Link>
  );
}

/** Initials avatar with the account menu: Account details, Change password, Sign out. */
function AccountMenu() {
  const { state, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const itemClass = 'flex min-h-11 w-full items-center gap-3 px-4 py-2 text-left text-sm text-ink hover:bg-page';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 rounded-md px-1.5 hover:bg-page"
      >
        <span className="inline-flex size-8 items-center justify-center rounded-full bg-gold text-xs font-bold text-ink">
          {initials(user.firstName, user.lastName)}
        </span>
        <span className="hidden text-sm font-medium text-ink rail:inline">{user.firstName}</span>
        <Icon name="expand_more" className="text-base text-muted" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-line bg-white py-1 shadow-lg">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-semibold text-ink">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted">{user.role === 'staff' ? 'SDO Officer' : user.id}</p>
          </div>
          <Link role="menuitem" to="/account" className={itemClass}>
            <Icon name="badge" className="text-base text-muted" />
            Account details
          </Link>
          <Link role="menuitem" to="/account/password" className={itemClass}>
            <Icon name="key" className="text-base text-muted" />
            Change password
          </Link>
          <button role="menuitem" type="button" onClick={() => void signOut()} className={`${itemClass} text-danger`}>
            <Icon name="logout" className="text-base" />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** "You have N unread" after sign-in. A status message, so screen readers announce it without taking focus. */
function UnreadToast() {
  const { toast, dismissToast } = useUnread();
  if (toast === null) return null;
  return (
    <div
      role="status"
      className="fixed right-3 bottom-20 left-3 z-20 flex max-w-sm items-center gap-3 rounded-lg border border-line-strong bg-white px-4 py-3 text-sm shadow-lg rail:bottom-6 rail:left-auto"
    >
      <Icon name="notifications" className="text-primary" />
      <span className="text-ink">{toast}</span>
      <Link to="/inbox" onClick={dismissToast} className="inline-flex min-h-11 items-center px-1 font-medium text-primary underline">
        View
      </Link>
      <button type="button" onClick={dismissToast} aria-label="Dismiss" className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted hover:text-ink">
        <Icon name="close" />
      </button>
    </div>
  );
}

function Breadcrumb({ role }: { role: 'staff' | 'student' }) {
  const location = useLocation();
  const crumbs = breadcrumb(role, location.pathname, location.search);
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((crumb, index) => (
          <li key={`${crumb}-${index}`} className="flex items-center gap-1">
            {index > 0 ? <Icon name="chevron_right" className="text-base" /> : null}
            <span className={index === crumbs.length - 1 ? 'font-semibold text-ink' : ''} aria-current={index === crumbs.length - 1 ? 'page' : undefined}>
              {crumb}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function PhoneBar({
  role,
  countFor,
  moreCount,
  onMore,
}: {
  role: 'staff' | 'student';
  countFor: (item: NavItem) => number;
  moreCount: number;
  onMore: () => void;
}) {
  const tabs = phoneTabs(role);
  const tabClass = 'relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium';
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-white print:hidden rail:hidden">
      {tabs.map((item) => {
        const count = countFor(item);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end ?? item.to === '/'}
            className={({ isActive }) => `${tabClass} ${isActive ? 'text-primary' : 'text-muted'}`}
          >
            <Icon name={item.icon} />
            <span className="whitespace-nowrap">{item.label}</span>
            {badgeText(count) === null ? null : (
              <span className="absolute top-1 left-1/2 ml-2 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white">
                {badgeText(count)}
              </span>
            )}
          </NavLink>
        );
      })}
      <button type="button" onClick={onMore} className={`${tabClass} text-muted`} aria-haspopup="dialog">
        <Icon name="menu" />
        <span>More</span>
        {badgeText(moreCount) === null ? null : (
          <span className="absolute top-1 left-1/2 ml-2 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-bold text-white">
            {badgeText(moreCount)}
          </span>
        )}
      </button>
    </nav>
  );
}

/** The phone "More" drawer: every group of the sidebar, with the create actions, and the account links. */
function MoreDrawer({ groups, countFor, onClose }: { groups: NavGroup[]; countFor: (item: NavItem) => number; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 bg-ink/50 rail:hidden" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="More"
        onClick={(event) => event.stopPropagation()}
        className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-xl bg-white p-4 pb-6"
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">More</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted">
            <Icon name="close" />
          </button>
        </div>
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{group.label}</p>
            <ul>
              {group.items.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} onClick={onClose} className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm font-medium text-ink hover:bg-page">
                    <Icon name={item.icon} className="text-primary" />
                    <span className="flex-1">{item.label}</span>
                    <CountBadge count={countFor(item)} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="mb-1 border-t border-line pt-3">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">Account</p>
          <Link to="/account" onClick={onClose} className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm font-medium text-ink hover:bg-page">
            <Icon name="badge" className="text-primary" />
            Account details
          </Link>
          <Link to="/account/password" onClick={onClose} className="flex min-h-11 items-center gap-3 rounded-md px-2 text-sm font-medium text-ink hover:bg-page">
            <Icon name="key" className="text-primary" />
            Change password
          </Link>
        </div>
      </div>
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
  const { state } = useAuth();
  const { unreadCount } = useUnread();
  const countFor = useBadgeCount();
  const [moreOpen, setMoreOpen] = useState(false);
  if (state.status !== 'authenticated') return null;
  const { user } = state;
  const groups = navGroups(user.role);

  return (
    <div className="min-h-screen rail:flex">
      <Sidebar groups={groups} countFor={countFor} role={user.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-1.5 print:hidden">
          <div className="flex min-w-0 items-center gap-2 rail:hidden">
            <img src={seal} alt="" className="size-8 rounded-full" />
            <span className="text-sm leading-tight font-bold text-ink">
              NU FAIRVIEW
              <span className="block text-[11px] font-normal text-muted">Student Discipline Office</span>
            </span>
          </div>
          <div className="hidden min-w-0 rail:block">
            <Breadcrumb role={user.role} />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden rail:inline-flex">
              <Bell />
            </span>
            <AccountMenu />
          </div>
        </div>
        <UnreadToast />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 rail:pb-6">
          <Outlet />
        </main>
      </div>

      <PhoneBar role={user.role} countFor={countFor} moreCount={unreadCount} onMore={() => setMoreOpen(true)} />
      {moreOpen ? <MoreDrawer groups={groups} countFor={countFor} onClose={() => setMoreOpen(false)} /> : null}
    </div>
  );
}

