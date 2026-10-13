import { useId } from 'react';
import type { NotificationView } from '@shared/types';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/utils/cn';
import { notificationLook, notificationWhenLong, openLabel, splitNotice } from '@/utils/inbox';
import { Dialog } from './Dialog';

/**
 * One notification in full (deck src 1931 to 1950): category icon and pill, the long date, the title, the body
 * with its line breaks, a notice's instructions, then Close and "Open …" to the record.
 */
export function MessageDialog({
  notification,
  onClose,
  onOpenRecord,
}: {
  notification: NotificationView | null;
  onClose: () => void;
  onOpenRecord: (href: string) => void;
}) {
  const titleId = useId();
  if (!notification) return null;
  const look = notificationLook(notification.kind);
  const { body, instructions } = notification.kind === 'notice' ? splitNotice(notification.message) : { body: notification.message, instructions: null };
  const label = openLabel(notification.href);
  return (
    <Dialog open labelledBy={titleId} onClose={onClose} maxWidth="max-w-[520px]">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-full', look.tint)}>
          <Icon name={look.icon} className="!text-[22px]" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2.5 py-0.5 text-[11px] font-semibold', look.tint)}>{look.category}</span>
            <span className="text-xs text-muted">{notificationWhenLong(notification.dateCreated)}</span>
          </p>
          <h2 id={titleId} className="mt-1.5 text-xl font-bold text-pretty text-ink">
            {notification.title}
          </h2>
        </div>
      </div>
      <p className="text-[15px] whitespace-pre-line text-pretty text-body">{body}</p>
      {instructions ? (
        <div className="rounded-[10px] bg-pending-soft px-3.5 py-3 text-warn-ink">
          <p className="text-xs font-bold tracking-[0.02em]">Instructions and reminders</p>
          <p className="mt-0.5 text-sm whitespace-pre-line text-pretty">{instructions}</p>
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap justify-end gap-2.5">
        <Button variant="neutral" size="md" onClick={onClose}>
          Close
        </Button>
        {label && notification.href ? (
          <Button size="md" onClick={() => onOpenRecord(notification.href as string)}>
            {label}
            <Icon name="arrow_forward" className="!text-xl" />
          </Button>
        ) : null}
      </div>
    </Dialog>
  );
}
