import { cn } from '@/utils/cn';

const LOOK = {
  all: { bar: 'bg-primary', value: 'text-ink' },
  Minor: { bar: 'bg-minor-accent', value: 'text-info-ink' },
  Major: { bar: 'bg-danger-strong', value: 'text-bad-ink' },
} as const;

/**
 * The three clickable class tiles above the student lists (deck src 1094 to 1102): All / Minor / Major,
 * a coloured bar on the left, the count large. They behave as tabs.
 */
export function ClassTiles<K extends keyof typeof LOOK>({
  label,
  tiles,
  value,
  onChange,
}: {
  label: string;
  tiles: ReadonlyArray<{ key: K; label: string; count: number }>;
  value: K;
  onChange: (key: K) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className="grid grid-cols-3 gap-3">
      {tiles.map((tile) => {
        const selected = tile.key === value;
        return (
          <button
            key={tile.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tile.key)}
            className={cn(
              '@container relative min-w-0 rounded-xl border-[1.5px] px-3.5 py-2.5 text-left outline-none hover:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/30',
              selected ? 'border-primary bg-tint-soft' : 'border-line bg-white',
            )}
          >
            <span aria-hidden="true" className={cn('absolute top-2.5 -left-px h-[34px] w-[5px] rounded-r-[3px]', LOOK[tile.key].bar)} />
            <span className="block truncate text-[clamp(12px,7cqi,13px)] font-semibold text-muted">{tile.label}</span>
            <span className={cn('block text-[clamp(32px,24cqi,48px)] leading-[1.05] font-extrabold tracking-[-0.02em]', LOOK[tile.key].value)}>{tile.count}</span>
          </button>
        );
      })}
    </div>
  );
}
