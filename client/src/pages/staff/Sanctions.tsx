import { useState } from 'react';
import type { StaffProofFileView, StaffSanctionView } from '@shared/types';
import { ConfirmModal, useToast } from '@/components/feedback';
import { FilePreview } from '@/components/feedback/FilePreview';
import { Button } from '@/components/ui/Button';
import { FileRow } from '@/components/ui/FileRow';
import { Icon, Resource, StatusPill, buttonClass, fieldClass } from '@/components/ui';
import { api, toApiError } from '@/api/client';
import { addDays, fileMeta, manilaToday } from '@/utils/files';
import { formatDate } from '@/utils/format';
import { useApi } from '@/hooks/useApi';

const msg = (error: unknown): string => toApiError(error).message;

/** "n of m viewed" (SPEC 4.3): verify stays blocked until every file was opened by staff. */
export function viewedSummary(files: ReadonlyArray<Pick<StaffProofFileView, 'viewed'>>): {
  viewed: number;
  total: number;
  allViewed: boolean;
} {
  const viewed = files.filter((file) => file.viewed).length;
  // Online proof only: with no uploaded file there is nothing to verify.
  return { viewed, total: files.length, allViewed: files.length > 0 && viewed === files.length };
}

function SanctionCard({ sanction, onChanged }: { sanction: StaffSanctionView; onChanged: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<'return' | null>(null);
  const [previewing, setPreviewing] = useState<StaffProofFileView | null>(null);
  const [busy, setBusy] = useState(false);
  const summary = viewedSummary(sanction.files);
  const pending = sanction.status === 'pending_verification';

  const succeed = (text: string) => {
    setForm(null);
    setPreviewing(null);
    toast.show(text, 'success');
    onChanged();
  };
  const failed = (error: unknown) => {
    setForm(null);
    toast.show(msg(error), 'error');
    onChanged();
  };

  async function verify() {
    setBusy(true);
    try {
      await api.verifySanction(sanction.id);
      succeed(`${sanction.sanctionCode} verified.`);
    } catch (error) {
      failed(error);
    } finally {
      setBusy(false);
    }
  }

  const verifyButton = (
    <Button
      variant="success"
      size="lg"
      className="flex-[1_1_150px] disabled:bg-success-disabled disabled:text-white"
      disabled={!summary.allViewed}
      disabledReason="Open each file before verifying"
      busy={busy}
      onClick={() => void verify()}
    >
      Verify sanction
    </Button>
  );
  const returnButton = (
    <Button variant="danger" size="lg" className="flex-[1_1_150px]" onClick={() => setForm('return')}>
      Return to student
    </Button>
  );

  return (
    <li className="rounded-xl border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-ink">
            {sanction.sanctionCode} · {sanction.type}
          </div>
          <div className="text-sm text-muted">
            Due {formatDate(sanction.dueDate)}
            {sanction.lateByDays > 0 ? (
              <span className="ml-2 rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-semibold text-bad-ink">Overdue</span>
            ) : null}
          </div>
        </div>
        <StatusPill status={sanction.status} kind="sanction" />
      </div>

      {sanction.staffNote ? (
        <p className="mt-3 rounded-[10px] bg-warn-soft px-3.5 py-2.5 text-[13px] text-amber-ink">
          {sanction.status === 'returned' ? 'Returned: ' : 'Instructions: '}
          {sanction.staffNote}
        </p>
      ) : null}

      <div className="mt-3 overflow-hidden rounded-xl border border-line">
        <div className="flex items-center gap-2.5 border-b border-line-soft bg-surface-2 px-3.5 py-3">
          <Icon name="attach_file" className="!text-xl text-primary" />
          <span className="flex-1 text-sm font-bold text-ink">Submitted proof</span>
          {summary.total > 0 ? (
            <span className="text-xs text-muted">
              {summary.viewed} of {summary.total} viewed
            </span>
          ) : null}
        </div>
        {sanction.files.length === 0 ? (
          <p className="flex items-center justify-center gap-1.5 px-3.5 py-4 text-[13px] text-muted">
            <Icon name="hourglass_top" className="!text-lg" />
            {pending ? 'No files were uploaded.' : 'Waiting for the student to upload proof.'}
          </p>
        ) : (
          <div className="flex flex-col">
            {sanction.files.map((file) => (
              <FileRow
                key={file.id}
                name={file.name}
                meta={fileMeta(file)}
                viewed={file.viewed}
                onView={() => setPreviewing(file)}
                className="rounded-none border-0 border-b border-line-soft last:border-b-0"
              />
            ))}
          </div>
        )}
      </div>

      {pending && !summary.allViewed && summary.total > 0 ? (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-amber-ink">
          <Icon name="info" className="!text-lg" />
          Open each file before you verify this sanction.
        </p>
      ) : null}

      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {verifyButton}
          {returnButton}
        </div>
      ) : null}

      {previewing ? (
        <FilePreview
          file={{ name: previewing.name, meta: fileMeta(previewing) }}
          loadUrl={async () => (await api.fileUrl(previewing.id)).url}
          onLoaded={onChanged}
          onClose={() => setPreviewing(null)}
          footer={
            pending ? (
              <>
                <span className="min-w-0 flex-[1_1_200px] text-[13px] text-muted">
                  {summary.allViewed ? 'All files viewed. You can verify this sanction.' : 'Open the other files before you verify.'}
                </span>
                {returnButton}
                {verifyButton}
              </>
            ) : undefined
          }
        />
      ) : null}

      <ConfirmModal
        open={form === 'return'}
        tone="danger"
        title={`Return ${sanction.sanctionCode} to the student?`}
        description="The sanction goes back to the student. Tell them what is missing."
        reasonLabel="What the student needs to fix"
        reasonPlaceholder="e.g. The service log is missing the supervisor’s signature."
        confirmLabel="Return sanction"
        onClose={() => setForm(null)}
        onConfirm={async (reason) => {
          try {
            await api.returnSanction(sanction.id, reason);
          } catch (error) {
            throw new Error(msg(error));
          }
          succeed(`${sanction.sanctionCode} returned to the student.`);
        }}
      />
    </li>
  );
}

export function SanctionsPanel({ sanctions, onChanged }: { sanctions: StaffSanctionView[]; onChanged: () => void }) {
  if (sanctions.length === 0) return null;
  return (
    <section className="mb-4">
      <h2 className="mb-2 text-lg font-semibold text-ink">Sanctions</h2>
      <ul className="space-y-2">
        {sanctions.map((sanction) => (
          <SanctionCard key={sanction.id} sanction={sanction} onChanged={onChanged} />
        ))}
      </ul>
    </section>
  );
}

/** Assign step: the offense number and the allowed sanctions come from the API, never from the staff member. */
export function AssignSanctionForm({
  caseId,
  onAssigned,
  onCancel,
}: {
  caseId: number;
  onAssigned: () => void;
  onCancel: () => void;
}) {
  const options = useApi(() => api.sanctionOptions(caseId), [caseId]);
  const today = manilaToday();
  const [sanctionId, setSanctionId] = useState<number | ''>('');
  const [dueDate, setDueDate] = useState(addDays(today, 14));
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-3 rounded-md border border-line-strong bg-page p-3">
      <h3 className="text-sm font-semibold text-ink">Assign a sanction</h3>
      <Resource resource={options} onRetry={options.reload}>
        {({ options: data }) => {
          const choices = data.sanctions.filter((s) => !s.alreadyAssigned);
          if (data.sanctions.length === 0) {
            return <p className="mt-2 text-sm text-muted">The handbook defines no sanction for this violation.</p>;
          }
          return (
            <form
              noValidate
              onSubmit={async (event) => {
                event.preventDefault();
                if (sanctionId === '') {
                  setError('Choose a sanction.');
                  return;
                }
                setBusy(true);
                setError(null);
                try {
                  await api.assignSanction(caseId, sanctionId, dueDate, note.trim());
                  onAssigned();
                } catch (caught) {
                  setError(msg(caught));
                  setBusy(false);
                }
              }}
            >
              <p className="mt-1 text-sm text-muted">
                This is offense number {data.offenseNumber} for this violation
                {data.offenseUsed !== null && data.offenseUsed !== data.offenseNumber
                  ? `; the handbook's highest defined offense (${data.offenseUsed}) applies`
                  : ''}
                .
              </p>
              <label className="mt-2 block text-sm font-medium text-ink">
                Sanction
                <select
                  className={`${fieldClass} mt-1`}
                  value={sanctionId}
                  onChange={(event) => setSanctionId(event.target.value === '' ? '' : Number(event.target.value))}
                >
                  <option value="">Choose a sanction…</option>
                  {choices.map((choice) => (
                    <option key={choice.sanctionId} value={choice.sanctionId}>
                      {choice.sanctionCode} · {choice.type}
                    </option>
                  ))}
                </select>
              </label>
              {choices.length === 0 ? (
                <p className="mt-1 text-sm text-muted">Every allowed sanction is already assigned.</p>
              ) : null}
              <label className="mt-2 block text-sm font-medium text-ink">
                Due date
                <input
                  type="date"
                  className={`${fieldClass} mt-1 max-w-48`}
                  value={dueDate}
                  min={today}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
              <label className="mt-2 block text-sm font-medium text-ink">
                Instructions (optional)
                <textarea
                  className={`${fieldClass} mt-1 min-h-16`}
                  value={note}
                  maxLength={1000}
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
              {error ? (
                <p role="alert" className="mt-1 text-sm font-medium text-danger">
                  {error}
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <button type="submit" disabled={busy || choices.length === 0} className={buttonClass}>
                  {busy ? 'Assigning…' : 'Assign'}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={busy}
                  className="rounded-md border border-line-strong bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-page"
                >
                  Cancel
                </button>
              </div>
            </form>
          );
        }}
      </Resource>
    </div>
  );
}
