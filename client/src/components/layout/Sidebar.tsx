import { NavLink, useLocation } from 'react-router-dom';
import seal from '@/assets/seal.png';
import { Icon } from '@/components/ui/Icon';
import { badgeText } from '@/context/UnreadContext';
import { cn } from '@/utils/cn';
import type { NavGroup, NavItem } from '@/utils/nav';

/** Is this nav entry the current page? "Violations" (`/handbook`) is not current on "Add violation" (`/handbook/new`). */
export function useIsActive() {
  const location = useLocation();
  return (item: NavItem, routerActive: boolean): boolean =>
    item.to === '/handbook' ? routerActive && location.pathname !== '/handbook/new' : routerActive;
}

function SideLink({ item, count, labels, onNavigate }: { item: NavItem; count: number; labels: boolean; onNavigate?: () => void }) {
  const isActive = useIsActive();
  const text = badgeText(count);
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      onClick={onNavigate}
      className={({ isActive: routerActive }) =>
        cn(
          'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold',
          labels ? 'justify-start' : 'justify-center',
          isActive(item, routerActive) ? 'bg-primary-active font-bold text-white' : 'font-medium text-white/88 hover:bg-white/10',
        )
      }
    >
      {({ isActive: routerActive }) => {
        const active = isActive(item, routerActive);
        return (
          <>
            {active ? <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-[3px] bg-gold" /> : null}
            <Icon name={item.icon} filled={active} className={active ? 'text-gold' : 'text-white/88'} />
            {labels ? <span className="flex-1 whitespace-nowrap">{item.label}</span> : null}
            {text !== null ? (
              <span
                aria-label={`${count} waiting`}
                className={cn(
                  'grid place-items-center rounded-full bg-gold font-bold text-ink',
                  labels ? 'h-[22px] min-w-[22px] px-[7px] text-xs' : 'absolute top-1.5 right-2.5 h-[18px] min-w-[18px] px-[5px] text-[11px]',
                )}
              >
                {text}
              </span>
            ) : null}
          </>
        );
      }}
    </NavLink>
  );
}

/**
 * The blue sidebar (deck src 264): 264 px with labels, an 80 px rail without, and the phone "More" drawer
 * (284 px, slides in from the left). A 4 px gold edge on the right.
 */
export function Sidebar({
  groups,
  countFor,
  role,
  labels,
  drawer = false,
  onNavigate,
  onClose,
}: {
  groups: NavGroup[];
  countFor: (item: NavItem) => number;
  role: 'staff' | 'student';
  labels: boolean;
  drawer?: boolean;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'flex flex-col overflow-hidden border-r-4 border-gold bg-primary text-white print:hidden',
        drawer ? 'h-full w-[284px] pt-[env(safe-area-inset-top)]' : cn('ui-zoom sticky top-0 h-[calc(100vh/var(--zoom))] shrink-0 transition-[width] duration-200',labels ? 'w-[264px]' : 'w-20'),
      )}
    >
      <div className={cn('flex h-[72px] shrink-0 items-center gap-3 border-b border-white/14 px-[18px]', labels ? 'justify-start' : 'justify-center')}>
        <img src={seal} alt="NU Fairview" className="w-[34px] shrink-0" />
        {labels ? (
          <div className="min-w-0 flex-1">
            <div className="text-base leading-tight font-bold tracking-[0.02em]">NU FAIRVIEW</div>
            <div className="truncate text-xs leading-snug text-gold-pale">
              {role === 'staff' ? 'Student Discipline Office · Staff' : 'Student Discipline Office'}
            </div>
          </div>
        ) : null}
        {drawer ? (
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full hover:bg-white/12 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
          >
            <Icon name="close" />
          </button>
        ) : null}
      </div>
      <nav aria-label="Main" className="flex-1 overflow-x-hidden overflow-y-auto p-3">
        {groups.map((group) => (
          <div key={group.label} className="mb-2.5">
            {labels ? (
              <p className="px-3 pt-2 pb-1.5 text-[13px] font-semibold text-white/66">{group.label}</p>
            ) : (
              <div aria-hidden="true" className="mx-2.5 my-2 h-px bg-white/16" />
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <SideLink key={item.to} item={item} count={countFor(item)} labels={labels} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
