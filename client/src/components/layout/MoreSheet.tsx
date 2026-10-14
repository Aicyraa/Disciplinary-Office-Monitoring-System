import { useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useDialogFocus } from '@/components/feedback/useDialogFocus';
import { Icon } from '@/components/ui/Icon';
import { badgeText } from '@/context/UnreadContext';
import { cn } from '@/utils/cn';
import type { NavItem } from '@/utils/nav';

/**
 * The phone "More" bottom sheet: a drag handle, the title and a round close button over one continuous white
 * list (no group headings) of the pages the tab bar does not hold. Backdrop and Escape close it.
 */
export function MoreSheet({ items, countFor, onClose }: { items: NavItem[]; countFor: (item: NavItem) => number; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus({ open: true, panelRef, onClose });
  return (
    <div
      className="fixed inset-0 z-[85] flex items-end bg-scrim rail:hidden"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="More"
        className="ui-zoom-phone flex max-h-[calc(85vh/var(--phone-zoom))] w-full flex-col rounded-t-[18px] bg-page pb-[calc(16px+env(safe-area-inset-bottom))] shadow-[0_-10px_40px_rgba(16,22,52,0.25)]"
      >
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong" />
        <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-2">
          <h2 className="text-lg font-bold text-ink">More</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-10 place-items-center rounded-full bg-white text-ink outline-none focus-visible:ring-[3px] focus-visible:ring-primary/25"
          >
            <Icon name="close" className="!text-xl" />
          </button>
        </div>
        <ul className="mx-4 mb-1 min-h-0 flex-1 overflow-y-auto rounded-2xl bg-white">
          {items.map((item, index) => {
            const count = countFor(item);
            const text = badgeText(count);
            return (
              <li key={item.to} className={cn(index > 0 && 'border-t border-line-soft')}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex h-14 items-center gap-3 px-3 text-[15px] outline-none focus-visible:ring-[3px] focus-visible:ring-primary/35 focus-visible:ring-inset',
                      index === 0 && 'rounded-t-2xl',
                      index === items.length - 1 && 'rounded-b-2xl',
                      isActive ? 'bg-row-selected font-bold text-ink' : 'font-medium text-ink hover:bg-row-hover',
                    )
                  }
                >
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-info-soft text-primary">
                    <Icon name={item.icon} className="!text-xl" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {text !== null ? (
                    <span
                      aria-label={`${count} waiting`}
                      className="grid h-[22px] min-w-[22px] place-items-center rounded-full bg-gold px-[7px] text-xs font-bold text-ink"
                    >
                      {text}
                    </span>
                  ) : null}
                  <Icon name="chevron_right" className="!text-xl text-muted-2" />
                </NavLink>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
