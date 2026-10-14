import { useState } from 'react';
import type { NoticeView } from '@shared/types';
import { useToast } from '@/components/feedback';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Textarea } from '@/components/ui/Textarea';
import { toApiError } from '@/api/client';
import { noticesApi } from '@/api/notices';
import { manilaToday } from '@/utils/files';
import { noticeToasts } from '@/utils/notices';
import { noticeErrors, type NoticeDraft, type NoticeErrors } from '@/validators/notice';

/** New or Edit notice (source src 1650 to 1662). */
export function NoticeForm({ notice, onDone, onCancel }: { notice: NoticeView | null; onDone: (id: number | null) => void; onCancel: () => void }) {
  const toast = useToast();
  const today = manilaToday();
  const [draft, setDraft] = useState<NoticeDraft>({
    title: notice?.title ?? '',
    message: notice?.message ?? '',
    instructions: notice?.instructions ?? '',
    expiresOn: notice?.expiresOn ?? '',
  });
  const [errors, setErrors] = useState<NoticeErrors>({});
  const [busy, setBusy] = useState(false);
  const set = (key: keyof NoticeDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  async function save() {
    const found = noticeErrors(draft, today);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setBusy(true);
    const body = {
      title: draft.title.trim(),
      message: draft.message.trim(),
      instructions: draft.instructions.trim() || undefined,
      expiresOn: draft.expiresOn || undefined,
    };
    try {
      if (notice) {
        await noticesApi.editNotice(notice.id, body);
        toast.show(noticeToasts.updated, 'success');
        onDone(notice.id);
      } else {
        const result = await noticesApi.publishNotice(body);
        toast.show(noticeToasts.published(result.recipients), 'success');
        onDone(result.noticeId);
      }
    } catch (error) {
      toast.show(toApiError(error).message, 'error');
      setBusy(false);
    }
  }

  return (
    <section aria-label={notice ? 'Edit notice' : 'New important notice'} className="flex flex-col gap-4 rounded-xl border border-line bg-white p-6">
      <div>
        <h2 className="text-[22px] font-bold text-ink">{notice ? 'Edit notice' : 'New important notice'}</h2>
        <p className="mt-1.5 text-[13px] text-pretty text-muted">
          {notice
            ? 'Changes show up for students right away. No new notification is sent.'
            : 'Published notices appear in every student’s bell and inbox, and are emailed to their school account.'}
        </p>
      </div>
      <Field label="Title" placeholder="e.g. Uniform inspection week" maxLength={120} value={draft.title} error={errors.title} onChange={(event) => set('title', event.target.value)} />
      <Textarea label="Message" rows={4} maxLength={1000} value={draft.message} error={errors.message} onChange={(event) => set('message', event.target.value)} />
      <Textarea
        label="Instructions or reminders (optional)"
        rows={3}
        maxLength={1000}
        placeholder="e.g. Bring a printed copy of your clearance form."
        value={draft.instructions}
        error={errors.instructions}
        onChange={(event) => set('instructions', event.target.value)}
      />
      <div className="max-w-60">
        <Field
          label="Expiration date (optional)"
          type="date"
          min={today}
          value={draft.expiresOn}
          error={errors.expiresOn}
          hint="Students stop seeing the notice after this date. Leave blank to keep it posted until you remove it."
          onChange={(event) => set('expiresOn', event.target.value)}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2.5">
        <Button variant="neutral" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button busy={busy} onClick={() => void save()}>
          <Icon name="campaign" className="!text-xl" />
          {notice ? 'Save changes' : 'Publish notice'}
        </Button>
      </div>
    </section>
  );
}
