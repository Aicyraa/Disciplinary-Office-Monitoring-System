import { useState } from 'react';
import type { NoticeView } from '@shared/types';
import { ConfirmModal, useToast } from '@/components/feedback';
import { PageError } from '@/components/feedback/PageState';
import { SkeletonList } from '@/components/feedback/Skeleton';
import { MasterDetail } from '@/components/layout/MasterDetail';
import { ListHeader } from '@/components/layout/ListHeader';
import { usePageAction } from '@/components/layout/PageAction';
import { Button } from '@/components/ui/Button';
import { DetailTable } from '@/components/ui/DetailTable';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { Icon } from '@/components/ui/Icon';
import { ListCard } from '@/components/ui/ListCard';
import { Pill } from '@/components/ui/Pill';
import { toApiError } from '@/api/client';
import { noticesApi } from '@/api/notices';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/utils/cn';
import { noticeFacts, noticeMeta, noticeToasts } from '@/utils/notices';
import { NoticeForm } from './notices/NoticeForm';

const state = (notice: NoticeView) => (
  <Pill tone={notice.expired ? 'neutral' : 'done'}>{notice.expired ? 'Expired' : 'Active'}</Pill>
);

function NoticeDetail({ notice, onEdit, onRemoved }: { notice: NoticeView; onEdit: () => void; onRemoved: () => void }) {
  const toast = useToast();
  const [removing, setRemoving] = useState(false);
  const facts = noticeFacts(notice);
  return (
    <article aria-label={notice.title} className="flex flex-col gap-5 rounded-xl border border-line bg-white p-6">
      <header className="flex items-start justify-between gap-3">
        <h2 className="text-[22px] leading-tight font-bold text-pretty text-ink">{notice.title}</h2>
        {state(notice)}
      </header>
      <DetailTable
        rows={[
          { label: 'Published', value: facts.published },
          { label: 'Visible until', value: facts.until },
          { label: 'Sent to', value: facts.reach },
          { label: 'Message', value: <span className="whitespace-pre-line">{notice.message}</span> },
          ...(notice.instructions ? [{ label: 'Instructions and reminders', value: <span className="whitespace-pre-line">{notice.instructions}</span> }] : []),
          ...(facts.edited ? [{ label: 'Edited', value: facts.edited }] : []),
        ]}
      />
      <div className="flex flex-wrap gap-2.5">
        <Button variant="neutral" onClick={onEdit}>
          <Icon name="edit" className="!text-xl" />
          Edit notice
        </Button>
        <Button variant="danger" onClick={() => setRemoving(true)}>
          <Icon name="delete" className="!text-xl" />
          Remove notice
        </Button>
      </div>
      <ConfirmModal
        open={removing}
        tone="danger"
        title="Remove this notice?"
        description={`“${notice.title}” is taken down from every student’s bell and inbox. The removal is recorded. Emails already sent cannot be taken back.`}
        confirmLabel="Remove notice"
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          try {
            await noticesApi.removeNotice(notice.id);
          } catch (error) {
            throw new Error(toApiError(error).message);
          }
          setRemoving(false);
          toast.show(noticeToasts.removed, 'success');
          onRemoved();
        }}
      />
    </article>
  );
}

/** Staff Notices (source src 1609 to 1668; not in the deck, UI-POLISH-SPEC 5.13): list, detail, form. */
export function NoticesPage() {
  const resource = useApi(() => noticesApi.notices(), []);
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<'detail' | 'new' | 'edit'>('detail');
  usePageAction('New notice', 'campaign', () => setMode('new'));

  if (resource.status === 'loading') {
    return (
      <SkeletonList label="Loading notices…" className="px-0" />
    );
  }
  if (resource.status === 'error') return <PageError page="Notices" detail={resource.error.message} onRetry={resource.reload} />;

  const notices = resource.data.notices;
  const current = notices.find((n) => n.id === selected) ?? (selected === null ? notices[0] : undefined);
  const done = (id: number | null) => {
    setMode('detail');
    setSelected(id);
    resource.reload();
  };

  const right =
    mode === 'new' ? (
      <NoticeForm notice={null} onDone={done} onCancel={() => setMode('detail')} />
    ) : mode === 'edit' && current ? (
      <NoticeForm key={current.id} notice={current} onDone={done} onCancel={() => setMode('detail')} />
    ) : current ? (
      <NoticeDetail key={current.id} notice={current} onEdit={() => setMode('edit')} onRemoved={() => done(null)} />
    ) : (
      <div className="grid min-h-60 place-items-center rounded-xl border border-line bg-white">
        <EmptyBlock icon="campaign" title="No notice selected">
          Pick a notice from the list, or publish a new one.
        </EmptyBlock>
      </div>
    );

  return (
    <>
      <h1 className="sr-only">Notices</h1>
      <MasterDetail
        ratio="notices"
        detailKey={mode === 'detail' ? (current?.id ?? null) : mode}
        backLabel="Notices"
        onBack={() => {
          setMode('detail');
          setSelected(null);
        }}
        list={
          <ListCard className="flex h-full flex-col">
            <ListHeader title="Important notices" subtitle="Shown in every student’s bell and inbox" />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {notices.length === 0 ? (
                <EmptyBlock icon="campaign" title="No notices published">
                  Publish a notice to reach every student at once.
                </EmptyBlock>
              ) : null}
              {notices.map((notice) => {
                const isSelected = mode === 'detail' && notice.id === current?.id;
                return (
                  <button
                    key={notice.id}
                    type="button"
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => {
                      setSelected(notice.id);
                      setMode('detail');
                    }}
                    className={cn(
                      'flex min-h-[72px] w-full items-center gap-3.5 border-b border-line-soft px-6 py-3 text-left outline-none transition-colors focus-visible:shadow-[inset_0_0_0_2px_var(--color-primary)]',
                      isSelected ? 'bg-row-selected shadow-[inset_3px_0_0_var(--color-primary)]' : 'bg-white hover:bg-row-hover',
                    )}
                  >
                    <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-pending-soft text-warn-ink">
                      <Icon name="campaign" className="!text-xl" />
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="block truncate font-semibold text-ink">{notice.title}</span>
                      <span className="mt-0.5 block text-xs text-muted">{noticeMeta(notice)}</span>
                    </span>
                    {state(notice)}
                  </button>
                );
              })}
            </div>
          </ListCard>
        }
        detail={mode === 'detail' && selected === null ? null : right}
        emptyDetail={right}
      />
    </>
  );
}
