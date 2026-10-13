import { useState, type FormEvent } from 'react';
import type { NoticeView } from '@shared/types';
import { ConfirmModal, useToast } from '@/components/feedback';
import { EmptyState, ErrorState, Icon, LoadingState, PageHeader, buttonClass, fieldClass } from '@/components/ui';
import { api, toApiError } from '@/api/client';
import { formatDate } from '@/utils/format';
import { manilaToday } from '@/utils/files';
import { useApi } from '@/hooks/useApi';

interface Draft {
  title: string;
  message: string;
  instructions: string;
  expiresOn: string;
}

const EMPTY: Draft = { title: '', message: '', instructions: '', expiresOn: '' };

/** Why a draft cannot be sent yet, or null. The API checks the same rules again. */
export function noticeProblem(draft: Draft, today: string): string | null {
  if (draft.title.trim() === '') return 'Enter a title.';
  if (draft.title.trim().length > 120) return 'The title is at most 120 characters.';
  if (draft.message.trim() === '') return 'Enter the message students will read.';
  if (draft.message.trim().length > 1000 || draft.instructions.trim().length > 1000) return 'Messages and instructions are at most 1000 characters.';
  if (draft.expiresOn !== '' && draft.expiresOn < today) return 'The expiry date cannot be in the past.';
  return null;
}

function NoticeForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  onSubmit: (draft: Draft) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = manilaToday();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = noticeProblem(draft, today);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(draft);
    } catch (caught) {
      setError(toApiError(caught).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-lg border border-line bg-white p-4">
      <div>
        <label htmlFor="notice-title" className="mb-1 block text-sm font-medium text-ink">
          Title
        </label>
        <input
          id="notice-title"
          className={`${fieldClass} min-h-11`}
          maxLength={120}
          placeholder="Uniform inspection week"
          value={draft.title}
          onChange={(event) => set('title', event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="notice-message" className="mb-1 block text-sm font-medium text-ink">
          Message
        </label>
        <textarea
          id="notice-message"
          className={`${fieldClass} min-h-24`}
          maxLength={1000}
          value={draft.message}
          onChange={(event) => set('message', event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="notice-instructions" className="mb-1 block text-sm font-medium text-ink">
          Instructions <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="notice-instructions"
          className={`${fieldClass} min-h-16`}
          maxLength={1000}
          value={draft.instructions}
          onChange={(event) => set('instructions', event.target.value)}
        />
      </div>
      <div>
        <label htmlFor="notice-expiry" className="mb-1 block text-sm font-medium text-ink">
          Show until <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="notice-expiry"
          type="date"
          min={today}
          className={`${fieldClass} min-h-11 max-w-48`}
          value={draft.expiresOn}
          onChange={(event) => set('expiresOn', event.target.value)}
        />
      </div>
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-white px-4 text-sm font-medium text-ink hover:bg-page"
        >
          Cancel
        </button>
        <button type="submit" disabled={busy} className={`${buttonClass} min-h-11`}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

/** Staff Notices: broadcast an important notice to every student, with an optional expiry (decision 1). */
export function NoticesPage() {
  const toast = useToast();
  const resource = useApi(() => api.notices(), []);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<NoticeView | null>(null);
  const [removing, setRemoving] = useState<NoticeView | null>(null);

  return (
    <>
      <PageHeader
        title="Notices"
        subtitle="An important notice appears in every student's inbox and is emailed to their school account."
        actions={
          <button type="button" className={`${buttonClass} min-h-11`} onClick={() => setComposing((value) => !value)} aria-expanded={composing}>
            {composing ? 'Close' : 'New notice'}
          </button>
        }
      />
      {composing ? (
        <div className="mb-4">
          <NoticeForm
            initial={EMPTY}
            submitLabel="Publish notice"
            onCancel={() => setComposing(false)}
            onSubmit={async (draft) => {
              const result = await api.publishNotice({
                title: draft.title.trim(),
                message: draft.message.trim(),
                instructions: draft.instructions.trim() || undefined,
                expiresOn: draft.expiresOn || undefined,
              });
              setComposing(false);
              toast.show(`Published to ${result.recipients} student${result.recipients === 1 ? '' : 's'}. Emails are on their way.`, 'success');
              resource.reload();
            }}
          />
        </div>
      ) : null}

      {resource.status === 'loading' ? <LoadingState label="Loading notices…" /> : null}
      {resource.status === 'error' ? <ErrorState message={resource.error.message} onRetry={resource.reload} /> : null}
      {resource.status === 'ready' ? (
        resource.data.notices.length === 0 ? (
          <EmptyState title="No notices yet." hint="Publish one to tell every student something important." />
        ) : (
          <ul className="space-y-3">
            {resource.data.notices.map((notice) =>
              editing?.id === notice.id ? (
                <li key={notice.id}>
                  <NoticeForm
                    initial={{
                      title: notice.title,
                      message: notice.message,
                      instructions: notice.instructions ?? '',
                      expiresOn: notice.expiresOn ?? '',
                    }}
                    submitLabel="Save changes"
                    onCancel={() => setEditing(null)}
                    onSubmit={async (draft) => {
                      await api.editNotice(notice.id, {
                        title: draft.title.trim(),
                        message: draft.message.trim(),
                        instructions: draft.instructions.trim() || undefined,
                        expiresOn: draft.expiresOn || undefined,
                      });
                      setEditing(null);
                      toast.show('Notice saved. Students see the new wording.', 'success');
                      resource.reload();
                    }}
                  />
                </li>
              ) : (
                <li key={notice.id} className="rounded-lg border border-line bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
                        <Icon name="campaign" className="text-primary" />
                        {notice.title}
                      </h2>
                      <p className="text-xs text-muted">
                        Posted {formatDate(notice.dateCreated)} by {notice.createdBy} · {notice.recipients} student
                        {notice.recipients === 1 ? '' : 's'}
                        {notice.expiresOn ? ` · ${notice.expired ? 'Expired' : 'Shown until'} ${formatDate(notice.expiresOn)}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(notice)}
                        className="inline-flex min-h-11 items-center rounded-md border border-line-strong bg-white px-3 text-sm font-medium text-ink hover:bg-page"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setRemoving(notice)}
                        className="inline-flex min-h-11 items-center rounded-md border border-danger px-3 text-sm font-medium text-danger hover:bg-page"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-line">{notice.message}</p>
                  {notice.instructions ? (
                    <p className="mt-1 text-sm text-muted whitespace-pre-line">
                      <span className="font-medium text-ink">What to do:</span> {notice.instructions}
                    </p>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        )
      ) : null}

      <ConfirmModal
        open={removing !== null}
        title="Remove this notice?"
        description="It disappears from every student's inbox. Emails already sent cannot be taken back."
        confirmLabel="Remove notice"
        danger
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          try {
            await api.removeNotice(removing.id);
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
          setRemoving(null);
          toast.show('Notice removed.', 'success');
          resource.reload();
        }}
      />
    </>
  );
}
