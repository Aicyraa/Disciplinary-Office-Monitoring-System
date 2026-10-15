import { useState } from 'react';
import type { StaffCaseDetail } from '@shared/types';
import { FormModal } from '@/components/feedback';
import { SkeletonPanel } from '@/components/feedback/Skeleton';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { toApiError } from '@/api/client';
import { sanctionsApi } from '@/api/sanctions';
import { useApi } from '@/hooks/useApi';
import { addDays, manilaToday } from '@/utils/files';

/** "Decide on a sanction" as a dialog: the sanction, its due date and instructions (SPEC flexible due date). */
export function AssignSanctionModal({ detail, onClose, done }: { detail: StaffCaseDetail; onClose: () => void; done: (toast: string) => void }) {
  const options = useApi(() => sanctionsApi.sanctionOptions(detail.id), [detail.id]);
  const today = manilaToday();
  const [picked, setPicked] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState(addDays(today, 14));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const choices = options.status === 'ready' ? options.data.options.sanctions.filter((s) => !s.alreadyAssigned) : [];
  const sanctionId: number | undefined = picked === '' ? choices[0]?.sanctionId : picked;
  const offense = options.status === 'ready' ? options.data.options.offenseNumber : null;

  async function assign() {
    if (sanctionId === undefined) return;
    setBusy(true);
    setError(null);
    try {
      await sanctionsApi.assignSanction(detail.id, sanctionId, dueDate, note.trim());
      done(`Sanction assigned for ${detail.code}.`);
    } catch (caught) {
      setError(toApiError(caught).message);
      setBusy(false);
    }
  }

  return (
    <FormModal
      open
      icon="gavel"
      title="Decide on a sanction"
      subtitle={`${detail.code} · ${offense !== null ? `Offense ${offense} for this violation` : 'Choose what the student must do'}`}
      busy={busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="lg" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="lg"
            busy={busy}
            disabled={sanctionId === undefined}
            disabledReason="Every allowed sanction is already assigned."
            onClick={() => void assign()}
          >
            Assign sanction
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {options.status === 'loading' ? <SkeletonPanel label="Loading the handbook options…" lines={2} className="border-0 p-0" /> : null}
        {options.status === 'error' ? <p className="text-[13px] text-danger">{options.error.message}</p> : null}
        {options.status === 'ready' ? (
          <>
            {options.data.options.sanctions.length === 0 ? (
              <p className="text-[13px] text-muted">The handbook defines no sanction for this violation.</p>
            ) : null}
            <div className="grid items-start gap-3 min-[520px]:grid-cols-[minmax(0,1fr)_minmax(0,180px)]">
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
              rows={4}
              maxLength={1000}
              placeholder="Anything the student should know"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="w-full resize-none"
            />
          </>
        ) : null}
        {error ? (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </FormModal>
  );
}
