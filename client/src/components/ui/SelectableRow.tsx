import type { ComponentProps } from 'react';
import { cn } from '@/utils/cn';

/** A row in a master list. The selected row gets the 3 px primary bar and `aria-current`. */
export function SelectableRow({
  selected,
  onSelect,
  className,
  type = 'button',
  ...rest
}: Omit<ComponentProps<'button'>, 'onClick'> & { selected: boolean; onSelect: () => void }) {
  return (
    <button
      type={type}
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
      className={cn(
        'block w-full border-b border-line-soft px-6 py-2.5 text-left outline-none transition-colors',
        'focus-visible:ring-[3px] focus-visible:ring-primary/35 focus-visible:ring-inset',
        selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
        className,
      )}
      {...rest}
    />
  );
}
