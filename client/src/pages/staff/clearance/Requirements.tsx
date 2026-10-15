import { useState } from 'react';
import type { StaffClearanceItemView, StaffClearanceView } from '@shared/types';
import { ProgressBar } from '@/components/dashboard/DashboardCards';
import { ConfirmModal, useToast } from '@/components/feedback';
import { Spinner } from '@/components/feedback/PageState';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Tag } from '@/components/ui/Tag';
import { toApiError } from '@/api/client';
import { clearanceApi } from '@/api/clearance';
import { clearanceCopy } from '@/utils/clearance';
import { cn } from '@/utils/cn';

type Pending = { kind: 'reverse' | 'remove'; item: StaffClearanceItemView } | { kind: 'add' } | null;

export function Requirements({ view, name, term, onChanged }: { view: StaffClearanceView; name: string; term: string; onChanged: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState<number | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const copy = clearanceCopy(name, term);
  const done = view.items.filter((item) => item.status === 'completed').length;
  const percent = view.items.length === 0 ? 0 : Math.round((done / view.items.length) * 100);
  const finish = (text: string) => {
    setPending(null);
    toast.show(text, 'success');
    onChanged();
  };
  const fail = (error: unknown): never => {
    throw new Error(toApiError(error).message);
  };

  async function mark(item: StaffClearanceItemView) {
    setSaving(item.requirementId);
    try {
      await clearanceApi.markRequirementDone(view.id, item.requirementId, '');
      finish(copy.marked(item.label));
    } catch (error) {
      toast.show(toApiError(error).message, 'error');
      onChanged();
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-3.5">
      <div>
        <p className="mb-1.5 flex justify-between text-[13px]">
          <span className="font-semibold text-ink">
            {done} of {view.items.length} requirements complete
          </span>
          <span className="text-muted">{percent}%</span>
        </p>
        <ProgressBar percent={percent} label="Clearance progress" tone="primary" />
      </div>
      <ul className="flex flex-col gap-2">
        {view.items.map((item) => {
          const completed = item.status === 'completed';
          return (
            <li
              key={item.requirementId}
              className={cn(
                'flex flex-wrap items-center gap-3 rounded-[10px] border py-2.5 pr-3 pl-3.5',
                completed ? 'border-success-line bg-success-soft/50' : 'border-calendar-closed bg-white',
              )}
            >
              <Icon name={completed ? 'check_circle' : 'radio_button_unchecked'} filled={completed} className={cn('!text-[22px]', completed ? 'text-success-strong' : 'text-disabled')} />
              <span className="min-w-0 flex-[1_1_160px]">
                <span className="flex flex-wrap items-center gap-2 font-medium text-ink">
                  {item.label}
                  {item.warning ? (
                    <Tag className="bg-bad-soft text-bad-ink">
                      Open cases: {view.openCases}
                    </Tag>
                  ) : null}
                </span>
                <span className={cn('block text-xs font-bold', completed ? 'text-success' : 'text-warn-ink')}>{completed ? 'Completed' : 'Remaining'}</span>
              </span>
              {saving === item.requirementId ? (
                <span role="status" className="inline-flex items-center gap-2 text-[13px] text-muted">
                  <Spinner />
                  Saving…
                </span>
              ) : completed ? (
                <button
                  type="button"
                  onClick={() => setPending({ kind: 'reverse', item })}
                  className="min-h-11 rounded-full border border-line-strong bg-white px-3.5 text-[13px] font-semibold whitespace-nowrap text-body outline-none hover:border-danger hover:text-danger focus-visible:ring-[3px] focus-visible:ring-primary/25 rail:min-h-[38px]"
                >
                  Reverse…
                </button>
              ) : (
                <Button size="sm" className="min-h-11 rail:min-h-[38px]" onClick={() => void mark(item)}>
                  Record completion
                </Button>
              )}
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                title="Remove requirement"
                onClick={() => setPending({ kind: 'remove', item })}
                className="grid size-11 shrink-0 place-items-center rounded-full text-muted outline-none hover:bg-danger-soft hover:text-danger focus-visible:ring-[3px] focus-visible:ring-danger/25 rail:size-9"
              >
                <Icon name="delete" className="!text-xl" />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto flex justify-end border-t border-line-soft pt-4">
        <Button variant="secondary" size="sm" className="min-h-11 rail:min-h-10" onClick={() => setPending({ kind: 'add' })}>
          <Icon name="add" className="!text-lg" />
          Add requirement
        </Button>
      </div>

      <ConfirmModal
        open={pending?.kind === 'reverse'}
        tone="danger"
        title={pending?.kind === 'reverse' ? `Reverse “${pending.item.label}”?` : ''}
        description="Reversals are saved to the change log with your name and reason."
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Sanction S-021 was reopened."
        confirmLabel="Reverse"
        cancelLabel="Keep it"
        onClose={() => setPending(null)}
        onConfirm={async (reason) => {
          if (pending?.kind !== 'reverse') return;
          await clearanceApi.reverseRequirement(view.id, pending.item.requirementId, reason).catch(fail);
          finish(copy.reversed(pending.item.label));
        }}
      />
      <ConfirmModal
        open={pending?.kind === 'remove'}
        tone="danger"
        title={pending?.kind === 'remove' ? `Remove “${pending.item.label}”?` : ''}
        description={copy.removeBody}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        onClose={() => setPending(null)}
        onConfirm={async () => {
          if (pending?.kind !== 'remove') return;
          await clearanceApi.removeRequirement(view.id, pending.item.requirementId).catch(fail);
          finish(copy.removed(pending.item.label));
        }}
      />
      <ConfirmModal
        open={pending?.kind === 'add'}
        title="Add a clearance requirement"
        description={copy.addBody}
        reasonLabel="Requirement"
        reasonPlaceholder="e.g. Return borrowed laboratory equipment"
        confirmLabel="Add requirement"
        onClose={() => setPending(null)}
        onConfirm={async (label) => {
          await clearanceApi.addRequirement(view.id, label).catch(fail);
          finish(copy.added);
        }}
      />
    </div>
  );
}
