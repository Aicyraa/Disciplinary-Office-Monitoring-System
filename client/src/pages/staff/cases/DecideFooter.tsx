import { useState } from 'react';
import type { StaffCaseDetail } from '@shared/types';
import { ConfirmModal } from '@/components/feedback';
import { Spinner } from '@/components/feedback/PageState';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { api, toApiError } from '@/api/client';
import { useApi } from '@/hooks/useApi';
import { addDays, manilaToday } from '@/utils/files';

const msg = (error: unknown): string => toApiError(error).message;

const nameOf = (detail: StaffCaseDetail): string => detail.student?.name ?? detail.claimed?.name ?? 'the student';

type Done = (toast: string) => void;

/** Validated: "Decide on a sanction" with the sanction, its due date and instructions (SPEC flexible due date). */
export function DecideFooter({ detail, done, allowResolve = true }: { detail: StaffCaseDetail; done: Done; allowResolve?: boolean }) {
  const options = useApi(() => api.sanctionOptions(detail.id), [detail.id]);
  const today = manilaToday();
  const [picked, setPicked] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState(addDays(today, 14));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolving, setResolving] = useState(false);

  const choices = options.status === 'ready' ? options.data.options.sanctions.filter((s) => !s.alreadyAssigned) : [];
  const sanctionId: number | undefined = picked === '' ? choices[0]?.sanctionId : picked;

  async function assign() {
    if (sanctionId === undefined) return;
    setBusy(true);
    setError(null);
    try {
      await api.assignSanction(detail.id, sanctionId, dueDate, note.trim());
      done(`Sanction assigned for ${detail.code}.`);
    } catch (caught) {
      setError(msg(caught));
      setBusy(false);
    }
  }

  return (
    <>
      <p className="text-sm font-semibold text-ink">Decide on a sanction</p>
      {options.status === 'loading' ? (
        <p role="status" className="flex items-center gap-2 text-[13px] text-muted">
          <Spinner />
          Loading the handbook options…
        </p>
      ) : null}
      {options.status === 'error' ? <p className="text-[13px] text-danger">{options.error.message}</p> : null}
      {options.status === 'ready' ? (
        <>
          {options.data.options.sanctions.length === 0 ? (
            <p className="text-[13px] text-muted">The handbook defines no sanction for this violation.</p>
          ) : (
            <Select
              label="Sanction"
              hint={`Offense ${options.data.options.offenseNumber} for this violation.`}
              value={sanctionId ?? ''}
              onChange={(event) => setPicked(Number(event.target.value))}
            >
              {choices.map((choice) => (
                <option key={choice.sanctionId} value={choice.sanctionId}>
                  {choice.sanctionCode} · {choice.type}
                </option>
              ))}
            </Select>
          )}
          <div className="grid gap-3 @min-[420px]:grid-cols-[180px_1fr]">
            <Field label="Due date" type="date" min={today} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            <Textarea label="Instructions (optional)" rows={2} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
          </div>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col items-stretch gap-2 pt-1">
        <Button size="xl" fullWidth busy={busy} disabled={sanctionId === undefined} disabledReason="Every allowed sanction is already assigned." onClick={() => void assign()}>
          Assign sanction
        </Button>
        {allowResolve ? (
          <button
            type="button"
            onClick={() => setResolving(true)}
            className="inline-flex min-h-11 items-center gap-1.5 self-center rounded-full px-3.5 text-[13px] font-semibold text-success outline-none hover:bg-success-soft focus-visible:ring-[3px] focus-visible:ring-primary/25 rail:min-h-9"
          >
            Resolve without sanction
          </button>
        ) : null}
      </div>
      <ConfirmModal
        open={resolving}
        tone="ok"
        title={`Resolve ${detail.code} without a sanction?`}
        description={`The case closes with no sanction. ${nameOf(detail)} is notified.`}
        reasonLabel="Reason (saved to case history)"
        reasonPlaceholder="e.g. First report, settled with a verbal reminder."
        confirmLabel="Resolve case"
        cancelLabel="Keep open"
        onClose={() => setResolving(false)}
        onConfirm={async (reason) => {
          try {
            await api.resolveWithoutSanction(detail.id, reason);
          } catch (error) {
            throw new Error(msg(error));
          }
          setResolving(false);
          done(`${detail.code} resolved.`);
        }}
      />
    </>
  );
}
