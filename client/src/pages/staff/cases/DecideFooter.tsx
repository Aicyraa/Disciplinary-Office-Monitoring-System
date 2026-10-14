import { useState } from 'react';
import type { StaffCaseDetail } from '@shared/types';
import { ConfirmModal } from '@/components/feedback';
import { Spinner } from '@/components/feedback/PageState';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
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

  const offense = options.status === 'ready' ? options.data.options.offenseNumber : null;
  return (
    <>
      <section aria-label="Decide on a sanction" className="flex flex-col gap-4 rounded-xl border border-line bg-white p-4">
        <header className="flex items-center gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-info-soft text-primary">
            <Icon name="gavel" className="!text-xl" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] leading-tight font-bold text-ink">Decide on a sanction</h3>
            <p className="text-xs text-muted">{offense !== null ? `Offense ${offense} for this violation` : 'Choose what the student must do'}</p>
          </div>
        </header>
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
            ) : null}
            <div className="grid items-start gap-3 @min-[420px]:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
              {options.data.options.sanctions.length > 0 ? (
                <Select label="Sanction" value={sanctionId ?? ''} onChange={(event) => setPicked(Number(event.target.value))}>
                  {choices.map((choice) => (
                    <option key={choice.sanctionId} value={choice.sanctionId}>
                      {choice.sanctionCode} · {choice.type}
                    </option>
                  ))}
                </Select>
              ) : null}
              <Field label="Due date" type="date" min={today} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <Textarea
              label="Instructions (optional)"
              rows={3}
              maxLength={1000}
              placeholder="Anything the student should know"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-[88px] w-full resize-none"
            />
          </>
        ) : null}
        {error ? (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2.5 border-t border-line-soft pt-4">
          <Button
            size="xl"
            className="flex-[2_1_180px]"
            busy={busy}
            disabled={sanctionId === undefined}
            disabledReason="Every allowed sanction is already assigned."
            onClick={() => void assign()}
          >
            Assign sanction
          </Button>
          {allowResolve ? (
            <Button variant="neutral" size="xl" className="flex-[1_1_160px]" onClick={() => setResolving(true)}>
              Resolve without sanction
            </Button>
          ) : null}
        </div>
      </section>
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
