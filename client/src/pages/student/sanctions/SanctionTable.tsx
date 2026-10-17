import { Link } from 'react-router-dom';
import type { StudentSanctionView } from '@shared/types';
import { StatusPill } from '@/components/ui';
import { ListCard } from '@/components/ui/ListCard';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/format';

/** The My sanctions table (deck src 1260 to 1277): ID, Sanction (with its case), Due, Status. */
export function SanctionTable({ rows, selectedId, emptyText = 'No sanctions with this status.' }: { rows: StudentSanctionView[]; selectedId: number | null; emptyText?: string }) {
  return (
    <ListCard className="flex min-h-0 flex-1 flex-col">
      <div className="hidden grid-cols-[60px_minmax(0,1fr)_100px_150px] gap-3 border-b border-line-soft bg-surface-2 px-6 py-3 text-[13px] font-semibold text-muted rail:grid">
        <span>ID</span>
        <span>Sanction</span>
        <span>Due</span>
        <span>Status</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? <p className="px-5 py-8 text-center text-[13px] text-muted">{emptyText}</p> : null}
        {rows.map((row) => {
          const selected = row.id === selectedId;
          return (
            <Link
              key={row.id}
              to={`/sanctions/${row.id}`}
              state={{ fromList: true }}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-line-soft px-4 py-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rail:grid rail:grid-cols-[60px_minmax(0,1fr)_100px_150px] rail:px-6',
                selected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
              )}
            >
              <span className="order-2 text-xs font-bold text-ink rail:order-none">{row.sanctionCode}</span>
              <span className="order-1 min-w-0 basis-full rail:order-none rail:basis-auto">
                <span className="block font-semibold text-ink">{row.type}</span>
                <span className="block text-xs text-muted">Case No. {row.caseCode}</span>
              </span>
              <span className="order-3 flex-1 text-xs text-muted rail:order-none">{formatDate(row.dueDate)}</span>
              <span className="order-4 rail:order-none">
                <StatusPill status={row.status} kind="sanction" />
              </span>
            </Link>
          );
        })}
      </div>
    </ListCard>
  );
}
