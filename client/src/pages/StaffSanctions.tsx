import { useState } from 'react';
import type { StaffProofFileView, StaffSanctionView } from '@shared/types';
import { ReasonForm } from '../components/ReasonForm';
import { Icon, Resource, StatusPill, buttonClass, fieldClass } from '../components/ui';
import { api, toApiError } from '../lib/api';
import { addDays, formatSize, manilaToday } from '../lib/files';
import { formatDate } from '../lib/format';
import { useApi } from '../lib/useApi';

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

/** Opening a proof file as staff marks it viewed on the server, so the list is refreshed afterwards. */
async function openProof(fileId: number): Promise<void> {
  // Open the tab inside the click so a pop-up blocker does not stop it, then point it at the link.
  const tab = window.open('', '_blank');
  try {
    const { url } = await api.fileUrl(fileId);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (error) {
    tab?.close();
    throw error;
  }
}

function SanctionCard({ sanction, onChanged }: { sanction: StaffSanctionView; onChanged: () => void }) {
  const [form, setForm] = useState<'return' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const summary = viewedSummary(sanction.files);

  const succeed = (text: string) => {
    setForm(null);
    setNotice({ tone: 'success', text });
    onChanged();
  };
  const failed = (error: unknown) => {
    setForm(null);
    setNotice({ tone: 'error', text: msg(error) });
    onChanged();
  };

  return (
    <li className="rounded-lg border border-line bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-medium text-ink">
            {sanction.sanctionCode} · {sanction.type}
          </div>
          <div className="text-sm text-muted">
            Due {formatDate(sanction.dueDate)}
            {sanction.lateByDays > 0 ? (
              <span className="ml-2 rounded bg-[#F7E6E6] px-1.5 py-0.5 text-xs font-semibold text-[#9B2C2C]">
                Late by {sanction.lateByDays} day{sanction.lateByDays === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        </div>
        <StatusPill status={sanction.status} />
      </div>

      {sanction.staffNote ? <p className="mt-2 text-sm">Instructions / note: {sanction.staffNote}</p> : null}
      {sanction.complianceNote ? <p className="mt-1 text-sm">Compliance recorded: {sanction.complianceNote}</p> : null}

      {sanction.files.length > 0 ? (
        <div className="mt-3">
          <div className="text-sm font-medium text-ink">
            Proof files{' '}
            <span className="font-normal text-muted">
              ({summary.viewed} of {summary.total} viewed)
            </span>
          </div>
          <ul className="mt-1 space-y-1">
            {sanction.files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <Icon
                    name={file.viewed ? 'check_circle' : 'radio_button_unchecked'}
                    className={file.viewed ? 'text-success' : 'text-muted'}
                  />
                  {file.name} <span className="text-muted">({formatSize(file.sizeBytes)})</span>
                </span>
                <button
                  type="button"
                  aria-label={`Open ${file.name}`}
                  className="rounded-md border border-line-strong px-2.5 py-1 text-xs font-medium text-ink hover:bg-page"
                  onClick={() => {
                    openProof(file.id).then(onChanged, failed);
                  }}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notice ? (
        <p
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`mt-2 text-sm font-medium ${notice.tone === 'error' ? 'text-danger' : 'text-success'}`}
        >
          {notice.text}
        </p>
      ) : null}

      {sanction.status === 'pending_verification' && !summary.allViewed ? (
        <p className="mt-2 text-xs text-muted">
          {summary.total === 0
            ? 'No proof file is attached. Return it so the student can upload one.'
            : `Open every file to enable Verify (${summary.viewed} of ${summary.total} opened).`}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {sanction.status === 'pending_verification' ? (
          <>
            <button
              type="button"
              className={buttonClass}
              disabled={!summary.allViewed}
              title={summary.allViewed ? undefined : 'Open every file first'}
              onClick={async () => {
                try {
                  await api.verifySanction(sanction.id);
                  succeed('Verified. The sanction is completed.');
                } catch (error) {
                  failed(error);
                }
              }}
            >
              Verify
            </button>
            <button
              type="button"
              className="rounded-md border border-danger px-4 py-2 text-sm font-semibold text-danger hover:bg-page"
              onClick={() => setForm('return')}
            >
              Return
            </button>
          </>
        ) : null}
      </div>
      {sanction.status === 'assigned' || sanction.status === 'returned' ? (
        <p className="mt-2 text-xs text-muted">Waiting for the student to upload proof. Files are the only way to complete a sanction.</p>
      ) : null}

      {form === 'return' ? (
        <ReasonForm
          title="Return for revision"
          description="The student is told why and can upload again."
          label="Reason (required)"
          submitLabel="Return"
          onCancel={() => setForm(null)}
          onSubmit={async (reason) => {
            try {
              await api.returnSanction(sanction.id, reason);
            } catch (error) {
              throw new Error(msg(error));
            }
            succeed('Returned to the student.');
          }}
        />
      ) : null}
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
