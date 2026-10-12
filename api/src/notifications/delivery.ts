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
  /**
   * Rows with email_status 'pending' whose id is greater than `afterId`, in id order (so oldest first). The
   * cursor lets a pass move on past rows that stay pending instead of meeting the same ones every time.
   */
  listPending(limit: number, afterId: number): Promise<PendingNotification[]>;
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
  /** Most addresses in one email (POWER-AUTOMATE.md section 5: batch about 50). Larger lists are split. */
  maxRecipientsPerEmail?: number;
  /** Only rows with an id above this are considered (see OutboxStore.listPending). */
  afterId?: number;
  /** Pending longer than this becomes failed. */
  maxPendingMs?: number;
}

export interface DeliveryReport {
  /** The highest id looked at, to pass as `afterId` to the next pass. */
  lastId: number;
  /** How many rows this pass looked at. Fewer than the batch size means the end of the queue was reached. */
  examined: number;
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

type Outcome = 'sent' | 'failed' | 'unknown' | 'skipped';

/**
 * One notification can need several emails (a long recipient list is split). It is only final when no email is
 * still undecided: any `unknown` keeps the row pending (a retry may repeat an email that already went out, the
 * known duplicate risk of POWER-AUTOMATE.md section 5); otherwise any `failed` makes it failed.
 */
export function combineOutcomes(outcomes: readonly Outcome[]): Outcome {
  if (outcomes.includes('unknown')) return 'unknown';
  if (outcomes.includes('failed')) return 'failed';
  if (outcomes.length > 0 && outcomes.every((outcome) => outcome === 'skipped')) return 'skipped';
  return 'sent';
}

const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let start = 0; start < items.length; start += size) chunks.push(items.slice(start, start + size));
  return chunks;
};

/**
 * One delivery run: expire what has waited too long, then send what is pending, in id order after `afterId`.
 * A notification is only ever sent from a row that was committed (the caller writes the row first), and the
 * outcome decides its `email_status`. It never throws for a delivery problem: those stay on the row, and one
 * row that cannot be processed never stops the rest of the pass.
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
  maxRecipientsPerEmail = 50,
  afterId = 0,
  maxPendingMs = DAY_MS,
}: DeliveryOptions): Promise<DeliveryReport> {
  const report: DeliveryReport = { lastId: afterId, examined: 0, sent: 0, failed: 0, skipped: 0, stillPending: 0, expired: 0 };

  report.expired = await store.failOlderThan(new Date(now().getTime() - maxPendingMs));

  for (const row of await store.listPending(batchSize, afterId)) {
    report.examined += 1;
    report.lastId = Math.max(report.lastId, row.notificationId);
    try {
      const recipients = await store.recipientsOf(row);
      if (recipients.length === 0) {
        await store.markResult(row.notificationId, 'skipped', now());
        report.skipped += 1;
        continue;
      }

      const audience = row.recipientType === 'staff' ? 'staff' : 'student';
      const linkUrl = absoluteUrl(appBaseUrl, linkPath(audience, row.linkType, row.linkId));
      const outcomes: Outcome[] = [];
      for (const group of chunk(recipients, maxRecipientsPerEmail)) {
        const payload = buildNotifyPayload(row.kind, {
          notificationId: row.notificationId,
          idempotencyKey: row.idempotencyKey,
          title: row.title,
          message: row.message,
          linkUrl,
          to: group.map((recipient) => recipient.email),
          greetingName: audience === 'student' ? (group[0].firstName ?? null) : null,
        });
        let outcome: Outcome = await send(row.kind, payload);
        for (let attempt = 1; outcome === 'unknown' && attempt < maxAttempts; attempt += 1) {
          await sleep(backoffMs * 2 ** (attempt - 1));
          outcome = await send(row.kind, payload);
        }
        outcomes.push(outcome);
        // Do not keep sending the remaining groups of a notification that is going to be retried anyway.
        if (outcome === 'unknown') break;
      }

      const final = combineOutcomes(outcomes);
      if (final === 'unknown') {
        report.stillPending += 1;
      } else {
        await store.markResult(row.notificationId, final, now());
        report[final] += 1;
      }
    } catch (error) {
      // Recording the result failed (database trouble). The row stays pending; carry on with the others.
      report.stillPending += 1;
      console.error(`Could not process notification ${row.notificationId}`, error);
    }
  }
  return report;
}

