import { cn } from '@/utils/cn';

/** A Material Symbols Outlined glyph. Decorative: the text next to it carries the meaning. */
export function Icon({ name, className = '', filled = false }: { name: string; className?: string; filled?: boolean }) {
  return (
    <span
      className={cn('material-symbols-outlined', filled && '[font-variation-settings:"FILL"_1]', className)}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
