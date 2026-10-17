import { NavLink } from 'react-router-dom';
import seal from '@/assets/seal.png';
import { Icon } from '@/components/ui/Icon';
import { badgeText } from '@/context/UnreadContext';
import { cn } from '@/utils/cn';
import type { NavGroup, NavItem } from '@/utils/nav';

function SideLink({ item, count, labels }: { item: NavItem; count: number; labels: boolean }) {
  const text = badgeText(count);
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      className={({ isActive }) =>
        cn(
          'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold',
          labels ? 'justify-start' : 'justify-center',
          isActive ? 'bg-primary-active font-bold text-white' : 'font-medium text-white/88 hover:bg-white/10',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-[3px] bg-gold" /> : null}
          <Icon name={item.icon} filled={isActive} className={isActive ? 'text-gold' : 'text-white/88'} />
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
      )}
    </NavLink>
  );
}

/**
 * The blue sidebar (deck src 264): 264 px with labels, an 80 px rail without, and a 4 px gold edge on the right.
 * The collapse toggle is pinned to the bottom, under a hairline; phones have no sidebar (they use the More sheet).
 */
export function Sidebar({
  groups,
  countFor,
  role,
  labels,
  onToggle,
}: {
  groups: NavGroup[];
  countFor: (item: NavItem) => number;
  role: 'staff' | 'student';
  labels: boolean;
  /** Collapses or expands the sidebar. */
  onToggle: () => void;
}) {
  const toggleLabel = labels ? 'Collapse sidebar' : 'Expand sidebar';
  return (
    <aside
      aria-label="Main navigation"
      className={cn(
        'ui-zoom sticky top-0 flex h-[calc(100vh/var(--zoom))] shrink-0 flex-col overflow-hidden border-r-4 border-gold bg-primary text-white transition-[width] duration-200 print:hidden',
        labels ? 'w-[264px]' : 'w-20',
      )}
    >
      <div className={cn('flex h-[72px] shrink-0 items-center gap-3 border-b border-white/14 px-[18px]', labels ? 'justify-start' : 'justify-center')}>
        {/* The seal is 48 px in a fixed 72 px bar; with labels its negative margins eat into the padding and gap, so the text keeps its place. */}
        <img src={seal} alt="NU Fairview" className={cn('size-12 shrink-0', labels && '-mr-1 -ml-2')} />
        {labels ? (
          <div className="min-w-0 flex-1">
            <div className="text-base leading-tight font-bold tracking-[0.02em]">NU FAIRVIEW</div>
            <div className="truncate text-xs leading-snug text-gold-pale">
              {role === 'staff' ? 'Student Discipline Office · Staff' : 'Student Discipline Office'}
            </div>
          </div>
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
                <SideLink key={item.to} item={item} count={countFor(item)} labels={labels} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-white/14 p-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={labels}
          aria-label={toggleLabel}
          title={labels ? undefined : toggleLabel}
          className={cn(
            'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-white/88 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold',
            labels ? 'justify-start' : 'justify-center',
          )}
        >
          <Icon name={labels ? 'left_panel_close' : 'left_panel_open'} />
          {labels ? <span className="whitespace-nowrap">Collapse sidebar</span> : null}
        </button>
      </div>
    </aside>
  );
}
