import type { NotificationKind, NotificationLinkType } from '@shared/types.js';
import type { SendToPowerAutomate } from '../integrations/power-automate.js';
import { linkPath } from './links.js';
import { buildNotifyPayload } from './render.js';

export interface PendingNotification {
  notificationId: number;
  kind: NotificationKind;
  recipientType: 'student' | 'staff';
  studentId: string | null;
  title: string;
  message: string;
  linkType: NotificationLinkType | null;
  linkId: number | null;
  idempotencyKey: string;
  dateCreated: Date;
}

export interface Recipient {
  email: string;
  /** First name, for the greeting. */
  firstName: string | null;
}

/** Everything delivery needs from the database. Tests use the in-memory version. */
export interface OutboxStore {
  /** Rows with email_status 'pending', oldest first. */
  listPending(limit: number): Promise<PendingNotification[]>;
  /**
   * Who gets the email: the student for a student notification; every active employee account for a staff
   * notification (there is no dedicated SDO mailbox). Empty means nobody can be emailed.
   */
  recipientsOf(row: PendingNotification): Promise<Recipient[]>;
  markResult(notificationId: number, status: 'sent' | 'failed' | 'skipped', at: Date): Promise<void>;
  /** Marks rows still pending since before `cutoff` as failed (SPEC decision 14). Returns how many. */
  failOlderThan(cutoff: Date): Promise<number>;
}

export interface DeliveryOptions {
  store: OutboxStore;
  send: SendToPowerAutomate;
  /** Absolute origin of the client app, for links inside emails. */
  appBaseUrl: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  /** Attempts per notification within one run (POWER-AUTOMATE.md section 5: up to 3). */
  maxAttempts?: number;
  /** Delay before the second attempt; doubles each time. */
  backoffMs?: number;
  batchSize?: number;
  /** Pending longer than this becomes failed. */
  maxPendingMs?: number;
}

export interface DeliveryReport {
  sent: number;
  failed: number;
  skipped: number;
  /** Tried but PA gave no answer; will be tried again by the next run. */
  stillPending: number;
  /** Marked failed because they were pending for more than 24 hours. */
  expired: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function absoluteUrl(appBaseUrl: string, path: string | null): string | null {
  if (path === null) return null;
  try {
    return new URL(path, appBaseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * One delivery run: expire what has waited too long, then send what is pending, in order. A notification is
 * only ever sent from a row that was committed (the caller writes the row first), and the outcome decides its
 * `email_status`. It never throws for a delivery problem: those stay on the row.
 */
export async function deliverPending({
  store,
  send,
  appBaseUrl,
  now = () => new Date(),
  sleep = realSleep,
  maxAttempts = 3,
  backoffMs = 1_000,
  batchSize = 50,
  maxPendingMs = DAY_MS,
}: DeliveryOptions): Promise<DeliveryReport> {
  const report: DeliveryReport = { sent: 0, failed: 0, skipped: 0, stillPending: 0, expired: 0 };

  report.expired = await store.failOlderThan(new Date(now().getTime() - maxPendingMs));

  for (const row of await store.listPending(batchSize)) {
    const recipients = await store.recipientsOf(row);
    if (recipients.length === 0) {
      await store.markResult(row.notificationId, 'skipped', now());
      report.skipped += 1;
      continue;
    }

    const audience = row.recipientType === 'staff' ? 'staff' : 'student';
    const payload = buildNotifyPayload(row.kind, {
      notificationId: row.notificationId,
      idempotencyKey: row.idempotencyKey,
      title: row.title,
      message: row.message,
      linkUrl: absoluteUrl(appBaseUrl, linkPath(audience, row.linkType, row.linkId)),
      to: recipients.map((recipient) => recipient.email),
      greetingName: audience === 'student' ? (recipients[0].firstName ?? null) : null,
    });

    let outcome = await send(row.kind, payload);
    for (let attempt = 1; outcome === 'unknown' && attempt < maxAttempts; attempt += 1) {
      await sleep(backoffMs * 2 ** (attempt - 1));
      outcome = await send(row.kind, payload);
    }

    if (outcome === 'sent' || outcome === 'failed' || outcome === 'skipped') {
      await store.markResult(row.notificationId, outcome, now());
      report[outcome] += 1;
    } else {
      report.stillPending += 1;
    }
  }
  return report;
}
