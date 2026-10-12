import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { NotificationKind } from '@shared/types.js';
import { createSendToPowerAutomate, type DeliveryOutcome } from '../integrations/power-automate.js';
import { combineOutcomes, deliverPending, type OutboxStore, type PendingNotification, type Recipient } from './delivery.js';
import { linkPath } from './links.js';
import { buildNotifyPayload, escapeHtml, notifyPayloadBuilders, type NotifyInput } from './render.js';
import { createDeliveryScheduler } from './scheduler.js';

const KINDS: NotificationKind[] = ['report', 'case', 'esc', 'sanction', 'appt', 'clr', 'account', 'newviol', 'notice'];

describe('linkPath', () => {
  test.each([
    ['student', 'case', 7, '/violations/7'],
    ['student', 'sanction', 3, '/sanctions'],
    ['student', 'appointment', 1, '/appointments'],
    ['student', 'clearance', 1, '/clearance'],
    ['student', 'inbox', null, '/inbox'],
    ['student', 'student', 5, null],
    ['staff', 'case', 7, '/cases/7'],
    ['staff', 'sanction', 3, '/cases'],
    ['staff', 'inbox', null, '/inbox'],
    ['staff', 'appointment', 1, null],
  ] as const)('%s / %s / %s -> %s', (audience, type, id, expected) => {
    expect(linkPath(audience, type, id)).toBe(expected);
  });

  test('no link type means no link; a bad id falls back to the list page', () => {
    expect(linkPath('student', null, 4)).toBeNull();
    expect(linkPath('student', 'case', 0)).toBe('/violations');
    expect(linkPath('staff', 'case', null)).toBe('/cases');
  });
});

describe('payload builders', () => {
  const input: NotifyInput = {
    notificationId: 12,
    idempotencyKey: 'san:12:completed',
    title: 'Sanction verified',
    message: 'Your CATEGORY - 1 (case C001) was verified as completed.',
    linkUrl: 'http://localhost:5173/sanctions',
    to: ['ana@students.nu-fairview.edu.ph'],
    greetingName: 'Ana',
  };

  test('there is exactly one builder per notification kind (the type is closed)', () => {
    expect(Object.keys(notifyPayloadBuilders).sort()).toEqual([...KINDS].sort());
  });

  test.each(KINDS)('%s builds a plain payload with exactly the documented fields', (kind) => {
    const payload = buildNotifyPayload(kind, input);
    expect(Object.keys(payload).sort()).toEqual(
      ['channel', 'cc', 'html_body', 'idempotency_key', 'link_url', 'notification_id', 'subject', 'to'].sort(),
    );
    expect(payload).toMatchObject({
      notification_id: 12,
      idempotency_key: 'san:12:completed',
      channel: 'email',
      to: 'ana@students.nu-fairview.edu.ph',
      cc: [],
      link_url: 'http://localhost:5173/sanctions',
    });
    expect(payload.subject).toContain('Sanction verified');
    expect(payload.html_body).toContain('Hi Ana,');
  });

  test('several recipients are joined with ";" in the one To field', () => {
    const payload = buildNotifyPayload('sanction', { ...input, to: ['a@nu-fairview.edu.ph', 'b@nu-fairview.edu.ph'], greetingName: null });
    expect(payload.to).toBe('a@nu-fairview.edu.ph;b@nu-fairview.edu.ph');
    expect(payload.html_body).toContain('Hello,');
  });

  test('user-written text cannot inject markup into the email', () => {
    const payload = buildNotifyPayload('case', {
      ...input,
      title: '<script>alert(1)</script>',
      message: 'Remark: <img src=x onerror=alert(1)> & "quoted"',
      greetingName: '<b>Ana</b>',
    });
    expect(payload.html_body).not.toContain('<script>');
    expect(payload.html_body).not.toContain('<img');
    expect(payload.html_body).not.toContain('<b>Ana</b>');
    expect(payload.html_body).toContain('&lt;script&gt;');
    expect(payload.html_body).toContain('&amp; &quot;quoted&quot;');
  });

  test('only an http(s) link is put into the email', () => {
    expect(buildNotifyPayload('case', { ...input, linkUrl: 'javascript:alert(1)' }).link_url).toBeNull();
    expect(buildNotifyPayload('case', { ...input, linkUrl: null }).html_body).not.toContain('<a ');
  });

  test('a line break in the title cannot become a second mail header', () => {
    const subject = buildNotifyPayload('case', { ...input, title: 'Hello\r\nBcc: attacker@example.com' }).subject;
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain('Hello Bcc: attacker@example.com');
  });

  test('the subject is bounded', () => {
    expect(buildNotifyPayload('case', { ...input, title: 'x'.repeat(500) }).subject.length).toBeLessThanOrEqual(200);
  });

  test('escapeHtml covers the five characters that matter', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });
});

describe('sendToPowerAutomate (the one outbound helper)', () => {
  const payload = buildNotifyPayload('sanction', {
    notificationId: 1,
    idempotencyKey: 'san:1:completed',
    title: 't',
    message: 'm',
    linkUrl: null,
    to: ['a@students.nu-fairview.edu.ph'],
    greetingName: 'A',
  });
  const NOTIFY_URL = 'https://flow.example.invalid/notify?sig=SECRET-SIGNATURE';
  const GATE_URL = 'https://flow.example.invalid/gate?sig=OTHER-SECRET';

  const reply = (status: number, body: unknown) =>
    vi.fn(async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));

  test('the request body is exactly { type, payload } and nothing else', async () => {
    const fetchImpl = reply(200, { status: 'sent' });
    const send = createSendToPowerAutomate({ urls: () => ({ notify: NOTIFY_URL }), fetchImpl });
    await send('sanction', payload);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(NOTIFY_URL);
    expect(init.method).toBe('POST');
    const body = JSON.parse(String(init.body));
    expect(Object.keys(body).sort()).toEqual(['payload', 'type']);
    expect(body.type).toBe('sanction');
    expect(body.payload).toEqual(payload);
  });

  test.each([
    [200, { status: 'sent' }, 'sent'],
    [200, { status: 'failed', error: 'mailbox full' }, 'failed'],
    [200, { status: 'something-else' }, 'unknown'],
    // Accepted but no readable status (a trigger with no Response action): sent, never re-sent.
    [200, 'not json', 'sent'],
    [202, '', 'sent'],
    [200, {}, 'sent'],
    [500, { status: 'sent' }, 'unknown'],
    [429, {}, 'unknown'],
    [404, '', 'unknown'],
  ] as Array<[number, unknown, DeliveryOutcome]>)('HTTP %i %j -> %s', async (status, body, expected) => {
    const send = createSendToPowerAutomate({ urls: () => ({ notify: NOTIFY_URL }), fetchImpl: reply(status, body) });
    expect(await send('case', payload)).toBe(expected);
  });

  test('an accepted request with no status warns once, without the URL', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const send = createSendToPowerAutomate({
      urls: () => ({ notify: NOTIFY_URL }),
      fetchImpl: vi.fn(async () => new Response('', { status: 202 })),
    });
    await send('case', payload);
    await send('case', payload);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toContain('SECRET-SIGNATURE');
    warn.mockRestore();
  });

  test('a network error or timeout is unknown, never an exception, and never mentions the URL', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logs = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const send = createSendToPowerAutomate({
      urls: () => ({ notify: NOTIFY_URL }),
      fetchImpl: vi.fn(async () => {
        throw new Error(`connect ECONNREFUSED ${NOTIFY_URL}`);
      }),
    });
    await expect(send('case', payload)).resolves.toBe('unknown');
    const written = JSON.stringify([...spy.mock.calls, ...logs.mock.calls]);
    expect(written).not.toContain('SECRET-SIGNATURE');
    spy.mockRestore();
    logs.mockRestore();
  });

  test('a call that never answers is cut off by the timeout', async () => {
    const send = createSendToPowerAutomate({
      urls: () => ({ notify: NOTIFY_URL }),
      timeoutMs: 20,
      fetchImpl: ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })) as unknown as typeof fetch,
    });
    await expect(send('case', payload)).resolves.toBe('unknown');
  });

  test('with no URL configured nothing is called and the result is skipped', async () => {
    const fetchImpl = reply(200, { status: 'sent' });
    const send = createSendToPowerAutomate({ urls: () => ({}), fetchImpl });
    expect(await send('case', payload)).toBe('skipped');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('every kind, the gate report included, goes to the one notify flow (PA_GATE_URL is not used)', async () => {
    const fetchImpl = reply(200, { status: 'sent' });
    const send = createSendToPowerAutomate({ urls: () => ({ notify: NOTIFY_URL, gate: GATE_URL }), fetchImpl });
    await send('report', payload);
    await send('case', payload);
    expect(fetchImpl.mock.calls.map((call) => (call as unknown as [string])[0])).toEqual([NOTIFY_URL, NOTIFY_URL]);
  });

  test('urls are read at call time', async () => {
    const config: { notify?: string } = {};
    const fetchImpl = reply(200, { status: 'sent' });
    const send = createSendToPowerAutomate({ urls: () => ({ notify: config.notify }), fetchImpl });
    expect(await send('case', payload)).toBe('skipped');
    config.notify = NOTIFY_URL;
    expect(await send('case', payload)).toBe('sent');
  });
});

// ---- delivery -----------------------------------------------------------------------------------

const NOW = new Date('2026-10-12T04:00:00Z');

function row(overrides: Partial<PendingNotification> = {}): PendingNotification {
  return {
    notificationId: 1,
    kind: 'sanction',
    recipientType: 'student',
    studentId: '2025-0000001',
    title: 'Sanction assigned',
    message: 'CATEGORY - 1 was assigned.',
    linkType: 'sanction',
    linkId: 7,
    idempotencyKey: 'san:7:assigned',
    dateCreated: new Date('2026-10-12T03:55:00Z'),
    ...overrides,
  };
}

function memoryOutbox(rows: PendingNotification[], recipients: Record<string, Recipient[]>) {
  const status = new Map<number, string>();
  const store: OutboxStore & { status: Map<number, string>; rows: PendingNotification[] } = {
    status,
    rows,
    async listPending(limit, afterId) {
      return rows
        .filter((r) => !status.has(r.notificationId) && r.notificationId > afterId)
        .sort((a, b) => a.notificationId - b.notificationId)
        .slice(0, limit);
    },
    async recipientsOf(r) {
      return recipients[r.recipientType === 'staff' ? 'staff' : (r.studentId ?? '')] ?? [];
    },
    async markResult(id, result) {
      status.set(id, result);
    },
    async failOlderThan(cutoff) {
      let count = 0;
      for (const r of rows) {
        if (!status.has(r.notificationId) && r.dateCreated.getTime() < cutoff.getTime()) {
          status.set(r.notificationId, 'failed');
          count += 1;
        }
      }
      return count;
    },
  };
  return store;
}

const student: Recipient = { email: 'ana@students.nu-fairview.edu.ph', firstName: 'Ana' };
const noSleep = async () => undefined;

describe('deliverPending', () => {
  test('sends a pending row, marks it sent, and builds the email from the row', async () => {
    const store = memoryOutbox([row()], { '2025-0000001': [student] });
    const send = vi.fn(async () => 'sent' as const);
    const report = await deliverPending({ store, send, appBaseUrl: 'http://localhost:5173', now: () => NOW, sleep: noSleep });
    expect(report).toMatchObject({ sent: 1, failed: 0, skipped: 0, stillPending: 0, expired: 0 });
    expect(store.status.get(1)).toBe('sent');
    const [kind, payload] = send.mock.calls[0] as unknown as [NotificationKind, ReturnType<typeof buildNotifyPayload>];
    expect(kind).toBe('sanction');
    expect(payload).toMatchObject({
      notification_id: 1,
      idempotency_key: 'san:7:assigned',
      to: 'ana@students.nu-fairview.edu.ph',
      link_url: 'http://localhost:5173/sanctions',
    });
    expect(payload.html_body).toContain('Hi Ana,');
  });

  test('a flow that answers "failed" is final: failed, no retry', async () => {
    const store = memoryOutbox([row()], { '2025-0000001': [student] });
    const send = vi.fn(async () => 'failed' as const);
    const report = await deliverPending({ store, send, appBaseUrl: 'http://localhost:5173', now: () => NOW, sleep: noSleep });
    expect(report.failed).toBe(1);
    expect(store.status.get(1)).toBe('failed');
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('"unknown" is retried in-run only when maxAttempts allows, with growing backoff, then stays pending', async () => {
    const store = memoryOutbox([row()], { '2025-0000001': [student] });
    const send = vi.fn(async () => 'unknown' as const);
    const sleep = vi.fn(async () => undefined);
    const report = await deliverPending({
      store,
      send,
      sleep,
      appBaseUrl: 'http://localhost:5173',
      now: () => NOW,
      backoffMs: 100,
      maxAttempts: 3,
    });
    expect(send).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((call) => (call as unknown as [number])[0])).toEqual([100, 200]);
    expect(report.stillPending).toBe(1);
    expect(store.status.has(1)).toBe(false);
  });

  test('by default one request per row per pass, then a growing cooldown (1, 2, 4 ... at most 30 minutes)', async () => {
    const store = memoryOutbox([row()], { '2025-0000001': [student] });
    const send = vi.fn(async () => 'unknown' as const);
    const retryState = new Map();
    let clock = NOW.getTime();
    const run = () =>
      deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => new Date(clock), retryState });

    expect(await run()).toMatchObject({ stillPending: 1, deferred: 0 });
    expect(send).toHaveBeenCalledTimes(1);

    clock += 30_000; // still inside the first minute: left alone
    expect(await run()).toMatchObject({ stillPending: 0, deferred: 1 });
    expect(send).toHaveBeenCalledTimes(1);

    clock += 31_000; // past 1 minute: tried again, next wait is 2 minutes
    await run();
    expect(send).toHaveBeenCalledTimes(2);
    clock += 100_000;
    await run();
    expect(send).toHaveBeenCalledTimes(2);
    clock += 21_000;
    await run();
    expect(send).toHaveBeenCalledTimes(3);

    // The wait is capped at 30 minutes.
    for (let i = 0; i < 10; i += 1) {
      clock += 30 * 60_000 + 1;
      await run();
    }
    expect(retryState.get(1).notBefore - clock).toBe(30 * 60_000);
  });

  test('a row that finally goes through is forgotten by the cooldown memory', async () => {
    const store = memoryOutbox([row()], { '2025-0000001': [student] });
    const outcomes: Array<'unknown' | 'sent'> = ['unknown', 'sent'];
    const send = vi.fn(async () => outcomes.shift() ?? 'sent');
    const retryState = new Map();
    let clock = NOW.getTime();
    const run = () =>
      deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => new Date(clock), retryState });
    await run();
    expect(retryState.size).toBe(1);
    clock += 61_000;
    await run();
    expect(store.status.get(1)).toBe('sent');
    expect(retryState.size).toBe(0);
  });

  test('requests to the flow are paced: a pause between sends, none before the first', async () => {
    const rows = [1, 2, 3].map((n) => row({ notificationId: n, idempotencyKey: `k${n}` }));
    const store = memoryOutbox(rows, { '2025-0000001': [student] });
    const send = vi.fn(async () => 'sent' as const);
    const sleep = vi.fn(async () => undefined);
    await deliverPending({ store, send, sleep, appBaseUrl: 'http://localhost:5173', now: () => NOW, pauseBetweenMs: 250 });
    expect(sleep.mock.calls.map((call) => (call as unknown as [number])[0])).toEqual([250, 250]);
    expect(send).toHaveBeenCalledTimes(3);
  });

  test('a backlog is bounded to the batch size (20 by default)', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => row({ notificationId: i + 1, idempotencyKey: `k${i}` }));
    const store = memoryOutbox(rows, { '2025-0000001': [student] });
    const send = vi.fn(async () => 'sent' as const);
    await deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW });
    expect(send).toHaveBeenCalledTimes(20);
  });

  test('a later attempt can succeed', async () => {
    const store = memoryOutbox([row()], { '2025-0000001': [student] });
    const outcomes: Array<'unknown' | 'sent'> = ['unknown', 'sent'];
    const send = vi.fn(async () => outcomes.shift() ?? 'sent');
    const report = await deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW, maxAttempts: 3 });
    expect(report.sent).toBe(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  test('rows still pending after 24 hours are marked failed, with a fake clock, and are not sent', async () => {
    const old = row({ notificationId: 2, dateCreated: new Date('2026-10-11T03:59:59Z') });
    const fresh = row({ notificationId: 3, idempotencyKey: 'san:8:assigned', dateCreated: new Date('2026-10-11T04:00:01Z') });
    const store = memoryOutbox([old, fresh], { '2025-0000001': [student] });
    const send = vi.fn(async () => 'sent' as const);
    const report = await deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW });
    expect(report.expired).toBe(1);
    expect(store.status.get(2)).toBe('failed');
    expect(store.status.get(3)).toBe('sent');
    expect(send).toHaveBeenCalledTimes(1);
  });

  test('a staff notification goes to every active employee in one email, with no personal greeting', async () => {
    const staff = [
      { email: 'officer@nu-fairview.edu.ph', firstName: 'Sam' },
      { email: 'second@nu-fairview.edu.ph', firstName: 'Lee' },
    ];
    const store = memoryOutbox(
      [row({ recipientType: 'staff', studentId: null, kind: 'sanction', linkType: 'case', linkId: 4, idempotencyKey: 'san:7:submitted:1' })],
      { staff },
    );
    const send = vi.fn(async () => 'sent' as const);
    await deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW });
    const payload = (send.mock.calls[0] as unknown as [string, ReturnType<typeof buildNotifyPayload>])[1];
    expect(payload.to).toBe('officer@nu-fairview.edu.ph;second@nu-fairview.edu.ph');
    expect(payload.html_body).toContain('Hello,');
    expect(payload.link_url).toBe('http://localhost:5173/cases/4');
  });

  test('nobody to email (no active employees, or an inactive student) is skipped, not retried forever', async () => {
    const store = memoryOutbox([row({ recipientType: 'staff', studentId: null })], { staff: [] });
    const send = vi.fn(async () => 'sent' as const);
    const report = await deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW });
    expect(report.skipped).toBe(1);
    expect(store.status.get(1)).toBe('skipped');
    expect(send).not.toHaveBeenCalled();
  });

  test('no flow configured: every row is skipped so a local run does not retry for a day', async () => {
    const store = memoryOutbox([row(), row({ notificationId: 2, idempotencyKey: 'x' })], { '2025-0000001': [student] });
    const send = createSendToPowerAutomate({ urls: () => ({}) });
    const report = await deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW });
    expect(report.skipped).toBe(2);
  });

  test('rows are sent in id order and a batch is bounded', async () => {
    const rows = [3, 1, 2].map((n) =>
      row({ notificationId: n, idempotencyKey: `k${n}`, dateCreated: new Date(Date.UTC(2026, 9, 12, 3, n)) }),
    );
    const store = memoryOutbox(rows, { '2025-0000001': [student] });
    const order: number[] = [];
    const send = vi.fn(async (_kind: NotificationKind, payload: { notification_id: number }) => {
      order.push(payload.notification_id);
      return 'sent' as const;
    });
    const report = await deliverPending({ store, send: send as never, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW, batchSize: 2 });
    expect(order).toEqual([1, 2]);
    expect(store.status.has(3)).toBe(false);
    expect(report).toMatchObject({ examined: 2, lastId: 2 });
  });

  test('rows that stay pending cannot starve newer ones: the cursor moves past them, then wraps', async () => {
    // 5 rows whose email never gets an answer, then one healthy row, with a batch of 3.
    const stuck = [1, 2, 3, 4, 5].map((n) => row({ notificationId: n, idempotencyKey: `stuck${n}` }));
    const healthy = row({ notificationId: 6, idempotencyKey: 'healthy' });
    const store = memoryOutbox([...stuck, healthy], { '2025-0000001': [student] });
    const send = vi.fn(async (_kind: NotificationKind, payload: { notification_id: number }) =>
      payload.notification_id === 6 ? ('sent' as const) : ('unknown' as const),
    );
    const base = { store, send: send as never, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW, batchSize: 3, maxAttempts: 1 };

    let cursor = 0;
    const first = await deliverPending({ ...base, afterId: cursor });
    cursor = first.examined < 3 ? 0 : first.lastId; // 1..3 examined, none done
    expect(store.status.has(6)).toBe(false);
    const second = await deliverPending({ ...base, afterId: cursor });
    cursor = second.examined < 3 ? 0 : second.lastId; // 4, 5, 6: the healthy row gets its turn
    expect(store.status.get(6)).toBe('sent');
    expect(second.sent).toBe(1);
    // End of the queue: a short batch wraps the cursor to 0 so stuck rows are retried.
    const third = await deliverPending({ ...base, afterId: cursor });
    expect(third.examined).toBe(0);
    expect(third.stillPending).toBe(0);
  });

  test('a long staff list is split into emails of at most 50 addresses, sent as separate requests', async () => {
    const employees = Array.from({ length: 120 }, (_, i) => ({ email: `emp${i}@nu-fairview.edu.ph`, firstName: `E${i}` }));
    const store = memoryOutbox([row({ recipientType: 'staff', studentId: null, linkType: 'case', linkId: 4 })], { staff: employees });
    const sizes: number[] = [];
    const send = vi.fn(async (_kind: NotificationKind, payload: { to: string }) => {
      sizes.push(payload.to.split(';').length);
      return 'sent' as const;
    });
    const report = await deliverPending({ store, send: send as never, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW });
    expect(sizes).toEqual([50, 50, 20]);
    expect(report.sent).toBe(1);
    expect(store.status.get(1)).toBe('sent');
  });

  test('if one group is undecided the notification stays pending and the remaining groups wait', async () => {
    const employees = Array.from({ length: 60 }, (_, i) => ({ email: `emp${i}@nu-fairview.edu.ph`, firstName: `E${i}` }));
    const store = memoryOutbox([row({ recipientType: 'staff', studentId: null })], { staff: employees });
    const send = vi.fn(async () => 'unknown' as const);
    const report = await deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW, maxAttempts: 2 });
    expect(send).toHaveBeenCalledTimes(2); // only the first group, twice
    expect(report.stillPending).toBe(1);
    expect(store.status.has(1)).toBe(false);
  });

  test('a row whose result cannot be recorded does not stop the rest of the pass', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const rows = [1, 2].map((n) => row({ notificationId: n, idempotencyKey: `k${n}` }));
    const store = memoryOutbox(rows, { '2025-0000001': [student] });
    const original = store.markResult.bind(store);
    store.markResult = async (id, result, at) => {
      if (id === 1) throw new Error('db hiccup');
      await original(id, result, at);
    };
    const send = vi.fn(async () => 'sent' as const);
    const report = await deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => NOW });
    expect(store.status.get(2)).toBe('sent');
    expect(report).toMatchObject({ sent: 1, stillPending: 1 });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  test('a row that was sent but whose result could not be recorded is not sent again on the next pass', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const store = memoryOutbox([row()], { '2025-0000001': [student] });
    store.markResult = async () => {
      throw new Error('db hiccup');
    };
    const send = vi.fn(async () => 'sent' as const);
    const retryState = new Map();
    let clock = NOW.getTime();
    const run = () =>
      deliverPending({ store, send, sleep: noSleep, appBaseUrl: 'http://localhost:5173', now: () => new Date(clock), retryState });
    await run();
    clock += 30_000;
    expect(await run()).toMatchObject({ deferred: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });
});

describe('combineOutcomes', () => {
  test.each([
    [['sent', 'sent'], 'sent'],
    [['sent', 'failed'], 'failed'],
    [['sent', 'unknown'], 'unknown'],
    [['failed', 'unknown'], 'unknown'],
    [['skipped', 'skipped'], 'skipped'],
    [['sent', 'skipped'], 'sent'],
    [[], 'sent'],
  ] as const)('%j -> %s', (outcomes, expected) => {
    expect(combineOutcomes(outcomes)).toBe(expected);
  });
});

describe('createDeliveryScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test('kick runs a pass in the background and returns at once', async () => {
    const run = vi.fn(async () => undefined);
    const scheduler = createDeliveryScheduler({ run, intervalMs: 1000 });
    scheduler.kick();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
  });

  test('passes never overlap: a kick during a pass asks for exactly one more pass', async () => {
    let release: () => void = () => undefined;
    let active = 0;
    let maxActive = 0;
    const run = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => (release = resolve));
      active -= 1;
    });
    const scheduler = createDeliveryScheduler({ run, intervalMs: 1000 });
    scheduler.kick();
    scheduler.kick();
    scheduler.kick();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(2);
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(maxActive).toBe(1);
  });

  test('the interval sweeps periodically and stop ends it', async () => {
    const run = vi.fn(async () => undefined);
    const scheduler = createDeliveryScheduler({ run, intervalMs: 1000 });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledTimes(3);
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(3);
  });

  test('a failing pass is reported, never thrown, and later passes still run', async () => {
    const onError = vi.fn();
    const run = vi.fn(async () => {
      throw new Error('db down');
    });
    const scheduler = createDeliveryScheduler({ run, intervalMs: 1000, onError });
    scheduler.kick();
    await vi.advanceTimersByTimeAsync(0);
    scheduler.kick();
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledTimes(2);
  });
});
