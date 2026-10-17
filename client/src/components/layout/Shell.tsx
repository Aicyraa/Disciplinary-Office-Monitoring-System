import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { AuthUser } from '@shared/types';
import seal from '@/assets/seal.png';
import { AccountDetailsModal, ChangePasswordModal } from '@/components/account/AccountModals';
import { ModalOpenProvider, useAnyModalOpen } from '@/components/feedback/modalOpen';
import { NudgeCard, PageLoading } from '@/components/feedback/PageState';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/context/AuthContext';
import { UnreadProvider, badgeText, useUnread } from '@/context/UnreadContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useUiZoom } from '@/hooks/useUiZoom';
import { useNavBadges } from '@/hooks/useNavBadges';
import { cn } from '@/utils/cn';
import { breadcrumb, moreItems, navGroups, phoneTabs, type NavItem } from '@/utils/nav';
import { BellPopover } from './BellPopover';
import { MoreSheet } from './MoreSheet';
import { PageActionProvider, usePageActionValue } from './PageAction';
import { Sidebar } from './Sidebar';

type AccountDialog = 'details' | 'password' | null;

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

/** Initials avatar with the account menu (deck W16, src 361): Account details, Change password, Sign out. */
function AccountMenu({ user, onOpen }: { user: AuthUser; onOpen: (dialog: Exclude<AccountDialog, null>) => void }) {
  const { signOut } = useAuth();
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

  const item =
    'flex min-h-11 w-full items-center gap-2.5 rounded-full px-2.5 text-left text-sm focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)] focus-visible:outline-none';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 items-center gap-2 rounded-full px-1.5 rail:min-h-[42px] text-ink hover:bg-[rgba(127,137,160,0.18)] focus-visible:shadow-[0_0_0_3px_rgba(242,212,107,0.6)] focus-visible:outline-none"
      >
        <Avatar firstName={user.firstName} lastName={user.lastName} url={user.avatarUrl} className="size-8 bg-gold text-xs" />
        <span className="hidden text-sm font-semibold whitespace-nowrap rail:inline">{user.firstName}</span>
        <Icon name="expand_more" className="!text-xl" />
      </button>
      {open ? (
        <div role="menu" aria-label="Account" className="absolute top-12 right-0 z-[60] w-[248px] origin-top-right animate-pop-in overflow-hidden rounded-xl border border-line bg-white text-body shadow-[0_16px_40px_rgba(16,22,52,0.18)]">
          <div className="border-b border-line-soft px-6 py-4">
            <p className="font-bold text-ink">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-muted">{user.role === 'staff' ? 'SDO Officer' : user.id}</p>
          </div>
          <div className="flex flex-col p-1.5">
            <button
              type="button"
              role="menuitem"
              className={cn(item, 'hover:bg-primary-tint')}
              onClick={() => {
                setOpen(false);
                onOpen('details');
              }}
            >
              <Icon name="badge" className="!text-xl text-muted" />
              Account details
            </button>
            <button
              type="button"
              role="menuitem"
              className={cn(item, 'hover:bg-primary-tint')}
              onClick={() => {
                setOpen(false);
                onOpen('password');
              }}
            >
              <Icon name="key" className="!text-xl text-muted" />
              Change password
            </button>
            <button type="button" role="menuitem" className={cn(item, 'text-danger hover:bg-danger-soft')} onClick={() => void signOut()}>
              <Icon name="logout" className="!text-xl" />
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Breadcrumb({ role }: { role: 'staff' | 'student' }) {
  const location = useLocation();
  const [portal, page] = breadcrumb(role, location.pathname);
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
      <span className="whitespace-nowrap">{portal}</span>
      <Icon name="chevron_right" className="!text-lg text-disabled" />
      <span aria-current="page" className="truncate font-semibold text-ink">
        {page}
      </span>
    </nav>
  );
}

/** The phone bottom bar (deck src 1916): four tabs and More; the icon sits in a pill and fills when active. */
function PhoneBar({
  role,
  countFor,
  moreCount,
  moreActive,
  onMore,
}: {
  role: 'staff' | 'student';
  countFor: (item: NavItem) => number;
  moreCount: number;
  moreActive: boolean;
  onMore: () => void;
}) {
  const tab = 'flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 px-0.5 pt-1 pb-1.5 focus-visible:rounded-xl focus-visible:shadow-[inset_0_0_0_2px_rgba(53,64,142,0.35)] focus-visible:outline-none';
  const content = (icon: string, label: string, active: boolean, count: number) => {
    const text = badgeText(count);
    return (
      <>
        <span className="relative grid h-[30px] w-14 place-items-center rounded-full">
          <Icon name={icon} filled={active} className="!text-2xl" />
          {text !== null ? (
            <span key={text} className="absolute -top-[3px] right-1.5 grid h-[18px] animate-pop-in min-w-[18px] place-items-center rounded-full border-2 border-white bg-danger-strong px-[5px] text-[11px] font-bold text-white">
              {text}
            </span>
          ) : null}
        </span>
        <span className={cn('max-w-full truncate text-xs leading-tight', active ? 'font-bold' : 'font-medium')}>{label}</span>
      </>
    );
  };
  return (
    <nav
      aria-label="Primary"
      className="ui-zoom-phone fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t border-line bg-white px-1 pt-1.5 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(16,22,52,0.06)] print:hidden rail:hidden"
    >
      {phoneTabs(role).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end ?? item.to === '/'}
          aria-label={countFor(item) > 0 ? `${item.label}, ${countFor(item)} waiting` : item.label}
          className={({ isActive }) => cn(tab, !moreActive && isActive ? 'text-primary' : 'text-muted-2')}
        >
          {({ isActive }) => content(item.icon, item.label, !moreActive && isActive, countFor(item))}
        </NavLink>
      ))}
      <button type="button" onClick={onMore} aria-label="More pages" aria-haspopup="dialog" className={cn(tab, moreActive ? 'text-primary' : 'text-muted-2')}>
        {content('menu', 'More', moreActive, moreCount)}
      </button>
    </nav>
  );
}

/** The phone's extended floating action button; it steps aside while a dialog or the More sheet is open. */
function FloatingAction({ hidden }: { hidden: boolean }) {
  const action = usePageActionValue();
  const modalOpen = useAnyModalOpen();
  if (!action || hidden || modalOpen) return null;
  return (
    <button
      type="button"
      onClick={action.onClick}
      className="ui-zoom-phone fixed right-[calc(16px/var(--phone-zoom))] bottom-[calc(84px/var(--phone-zoom))] z-[45] inline-flex h-[52px] animate-pop-in transition-transform active:scale-95 items-center gap-2 rounded-2xl bg-primary px-5 text-[15px] font-semibold whitespace-nowrap text-white shadow-[0_6px_18px_rgba(16,22,52,0.3)] outline-none active:bg-primary-press focus-visible:ring-[3px] focus-visible:ring-gold print:hidden rail:hidden"
    >
      <Icon name={action.icon} className="!text-2xl" />
      {action.label}
    </button>
  );
}

/**
 * Phone page header, the large-title pattern of phone apps: the seal line, a big page title and the bell and
 * avatar scroll with the content; once the big title is gone a compact bar with the title stays on top.
 */
function PhoneTitle({ user, onOpen }: { user: AuthUser; onOpen: (dialog: Exclude<AccountDialog, null>) => void }) {
  const location = useLocation();
  const [, page] = breadcrumb(user.role, location.pathname);
  const titleRef = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const title = titleRef.current;
    if (!title || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => setCompact(entry ? !entry.isIntersecting : false));
    observer.observe(title);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Title only: the bell and avatar have one home (the header below), so their popovers never open twice. */}
      <div
        aria-hidden="true"
        className={cn(
          'ui-zoom-phone pointer-events-none fixed inset-x-0 top-0 z-40 border-b border-line bg-white/92 px-4 pt-[env(safe-area-inset-top)] text-center backdrop-blur-md transition-[opacity,transform] duration-200 print:hidden rail:hidden',
          compact ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
        )}
      >
        <p className="truncate py-3.5 text-[17px] leading-6 font-bold text-ink">{page}</p>
      </div>
      <div className="mb-3 flex items-start gap-2 print:hidden rail:hidden">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
            <img src={seal} alt="" className="size-5" />
            NU Fairview · SDO
          </p>
          <div ref={titleRef} className="mt-0.5 truncate text-[28px] leading-tight font-extrabold text-ink">
            {page}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <BellPopover role={user.role} />
          <AccountMenu user={user} onOpen={onOpen} />
        </div>
      </div>
    </>
  );
}

/** Students see the unread nudge after sign-in (src 2074), 7 s: in the page flow on a phone (it pushes content down), top right under the header on wide screens. */
function UnreadNudge({ role }: { role: 'staff' | 'student' }) {
  const { toast, dismissToast } = useUnread();
  if (toast === null || role !== 'student') return null;
  return (
    <div className="mb-3 flex justify-end print:hidden rail:fixed rail:top-[76px] rail:right-5 rail:left-auto rail:z-[70] rail:mb-0">
      <NudgeCard text={toast} onDismiss={dismissToast} />
    </div>
  );
}

export function Shell() {
  const { state } = useAuth();
  if (state.status !== 'authenticated') return null;
  return (
    <UnreadProvider role={state.user.role}>
      <ModalOpenProvider>
        <PageActionProvider>
          <ShellFrame user={state.user} />
        </PageActionProvider>
      </ModalOpenProvider>
    </UnreadProvider>
  );
}

function ShellFrame({ user }: { user: AuthUser }) {
  const { unreadCount } = useUnread();
  const countFor = useBadgeCount();
  const location = useLocation();
  const navigate = useNavigate();
  useUiZoom();
  useDocumentTitle(breadcrumb(user.role, location.pathname)[1] ?? '');
  const wide = useMediaQuery('(min-width: 1100px)');
  // null = follow the width (rail from 720 to 1100 px, full sidebar above); the sidebar toggle overrides it.
  const [collapsedChoice, setCollapsedChoice] = useState<boolean | null>(null);
  const collapsed = collapsedChoice ?? !wide;
  const [moreOpen, setMoreOpen] = useState(false);
  const [dialog, setDialog] = useState<AccountDialog>(null);
  const role = user.role;
  const groups = navGroups(role);
  const onTab = phoneTabs(role).some((item) => (item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)));

  useEffect(() => setMoreOpen(false), [location.pathname]);

  // `/account` and `/account/password` open the dialogs over the dashboard (UI-POLISH-SPEC 5.10).
  useEffect(() => {
    const wanted = (location.state as { account?: AccountDialog } | null)?.account;
    if (wanted) {
      setDialog(wanted);
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [location, navigate]);

  return (
    <div className="min-h-screen rail:flex">
      <div className="hidden rail:block">
        <Sidebar groups={groups} countFor={countFor} role={role} labels={!collapsed} onToggle={() => setCollapsedChoice(!collapsed)} />
      </div>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="ui-zoom sticky top-0 z-40 hidden h-16 items-center gap-3 border-b border-line bg-white px-8 text-ink print:hidden rail:flex">
          <div className="min-w-0">
            <Breadcrumb role={role} />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <BellPopover role={role} />
            <AccountMenu user={user} onOpen={setDialog} />
          </div>
        </header>

        <main className="ui-zoom w-full flex-1 p-4 pt-[calc(16px+env(safe-area-inset-top))] pb-[calc(88px+env(safe-area-inset-bottom))] rail:p-8">
          <UnreadNudge role={role} />
          <PhoneTitle user={user} onOpen={setDialog} />
          {/* Keyed on the first path segment only: list -> detail inside one page keeps its state and does not replay. */}
          <div key={location.pathname.split('/')[1] ?? ''} className="page-enter">
            {/* Pages load as separate chunks (AppRoutes); the frame stays put while one arrives. */}
            <Suspense fallback={<PageLoading page="the page" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <PhoneBar role={role} countFor={countFor} moreCount={role === 'student' ? unreadCount : 0} moreActive={moreOpen || !onTab} onMore={() => setMoreOpen((value) => !value)} />
      <FloatingAction hidden={moreOpen} />
      {moreOpen ? <MoreSheet items={moreItems(role)} countFor={countFor} onClose={() => setMoreOpen(false)} /> : null}

      <AccountDetailsModal open={dialog === 'details'} user={user} onClose={() => setDialog(null)} onChangePassword={() => setDialog('password')} />
      <ChangePasswordModal open={dialog === 'password'} onClose={() => setDialog(null)} />
    </div>
  );
}
