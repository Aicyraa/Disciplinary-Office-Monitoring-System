import type { NotificationKind, NotificationLinkType } from '@shared/types.js';
import type { SendToPowerAutomate } from '../../integrations/power-automate.js';
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
  /**
   * Attempts per notification within one run. One by default: a row that got no answer waits for its cooldown
   * (`retryState`) instead of being sent again straight away, because every attempt may really send an email.
   */
  maxAttempts?: number;
  /** Delay before a second in-run attempt (only when `maxAttempts` > 1); doubles each time. */
  backoffMs?: number;
  /**
   * Cooldown memory that outlives one run (the caller keeps the Map): per row, how many passes found no answer
   * and the earliest time it may be tried again (1 minute, doubling, at most 30 minutes). Without it every
   * pass retries every undecided row.
   */
  retryState?: Map<number, RetryEntry>;
  /** Pause between two requests to the flow, so a backlog is not fired as a burst. */
  pauseBetweenMs?: number;
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
  /** Tried but PA gave no answer; will be tried again after its cooldown. */
  stillPending: number;
  /** Left alone this pass because the row is still cooling down after an unanswered attempt. */
  deferred: number;
  /** Marked failed because they were pending for more than 24 hours. */
  expired: number;
}

export interface RetryEntry {
  attempts: number;
  /** Epoch milliseconds before which the row is not tried again. */
  notBefore: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const COOLDOWN_BASE_MS = 60_000;
const COOLDOWN_MAX_MS = 30 * 60_000;
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
  maxAttempts = 1,
  backoffMs = 1_000,
  retryState = new Map<number, RetryEntry>(),
  pauseBetweenMs = 0,
  batchSize = 20,
  maxRecipientsPerEmail = 50,
  afterId = 0,
  maxPendingMs = DAY_MS,
}: DeliveryOptions): Promise<DeliveryReport> {
  const report: DeliveryReport = {
    lastId: afterId,
    examined: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    stillPending: 0,
    deferred: 0,
    expired: 0,
  };

  report.expired = await store.failOlderThan(new Date(now().getTime() - maxPendingMs));

  let requestsMade = 0;
  for (const row of await store.listPending(batchSize, afterId)) {
    report.examined += 1;
    report.lastId = Math.max(report.lastId, row.notificationId);
    const cooling = retryState.get(row.notificationId);
    if (cooling && cooling.notBefore > now().getTime()) {
      report.deferred += 1;
      continue;
    }
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
          greetingName: audience === 'student' ? (group[0].firstName ?? null) : null,        });
        if (requestsMade > 0 && pauseBetweenMs > 0) await sleep(pauseBetweenMs);
        requestsMade += 1;
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
        const attempts = (cooling?.attempts ?? 0) + 1;
        const wait = Math.min(COOLDOWN_MAX_MS, COOLDOWN_BASE_MS * 2 ** (attempts - 1));
        retryState.set(row.notificationId, { attempts, notBefore: now().getTime() + wait });
      } else {
        await store.markResult(row.notificationId, final, now());
        retryState.delete(row.notificationId);
        report[final] += 1;
      }
    } catch (error) {
      // Recording the result failed (database trouble). The row stays pending; carry on with the others. It gets a
      // cooldown too, so a row that was already sent is not emailed again on every pass while the database is down.
      report.stillPending += 1;
      const attempts = (cooling?.attempts ?? 0) + 1;
      const wait = Math.min(COOLDOWN_MAX_MS, COOLDOWN_BASE_MS * 2 ** (attempts - 1));
      retryState.set(row.notificationId, { attempts, notBefore: now().getTime() + wait });
      console.error(`Could not process notification ${row.notificationId}`, error);
    }
  }
  return report;
}

