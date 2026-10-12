import type { NotificationKind } from '@shared/types.js';
import type { NotifyPayload } from '../notifications/render.js';

/**
 * What one call to Power Automate came to (POWER-AUTOMATE.md section 4, rule 5):
 * - `sent`: HTTP 200 with `{"status":"sent"}`;
 * - `failed`: HTTP 200 with `{"status":"failed"}` (the flow tried and could not send);
 * - `unknown`: timeout, network error, non-2xx or an unreadable body (try again later);
 * - `skipped`: no flow URL is configured for this kind, so nothing was attempted (local development).
 */
export type DeliveryOutcome = 'sent' | 'failed' | 'unknown' | 'skipped';

/** The only shape ever sent to Power Automate: exactly `type` and `payload`. */
export interface PowerAutomateRequest {
  type: NotificationKind;
  payload: NotifyPayload;
}

export interface PowerAutomateOptions {
  /** URLs are read lazily on every call so a restart is not needed to pick up a changed .env in tests. */
  urls: () => { notify?: string; gate?: string };
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export type SendToPowerAutomate = (type: NotificationKind, payload: NotifyPayload) => Promise<DeliveryOutcome>;

/**
 * The one helper every outbound Power Automate call goes through. It never throws into the caller (a failed
 * email must not break a business action), never logs the URL or the email body, and uses the gate flow's URL
 * only for `report`.
 */
export function createSendToPowerAutomate({ urls, fetchImpl = fetch, timeoutMs = 10_000 }: PowerAutomateOptions): SendToPowerAutomate {
  return async (type, payload) => {
    const configured = urls();
    const url = type === 'report' ? (configured.gate ?? configured.notify) : configured.notify;
    if (!url) return 'skipped';

    const body: PowerAutomateRequest = { type, payload };
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) return 'unknown';
      const reply: unknown = await response.json().catch(() => null);
      const status = typeof reply === 'object' && reply !== null ? (reply as { status?: unknown }).status : undefined;
      if (status === 'sent') return 'sent';
      if (status === 'failed') return 'failed';
      return 'unknown';
    } catch {
      // Timeout, DNS or connection failure: say nothing that could contain the URL.
      return 'unknown';
    }
  };
}

/** Reads the flow URLs from the environment, at call time. They are never given a VITE_ prefix. */
export const urlsFromEnv = (): { notify?: string; gate?: string } => ({
  notify: process.env.PA_NOTIFY_URL || undefined,
  gate: process.env.PA_GATE_URL || undefined,
});
