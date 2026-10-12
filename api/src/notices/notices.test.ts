import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMemoryNotifications, type MemoryNotifications } from '../notifications/memory.js';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A, STUDENT_B } from '../testing/harness.js';
import { createMemoryNoticeStore } from './memory-store.js';
import { createNoticeService, inboxMessage } from './service.js';

// Monday 2026-10-12 in Manila.
const NOW = new Date('2026-10-12T02:00:00Z');

let notifications: MemoryNotifications;
let notices: ReturnType<typeof createMemoryNoticeStore>;
let published = 0;

function build() {
  const expired = () => notices.notices.filter((n) => n.expiresOn !== null && n.expiresOn < '2026-10-12').map((n) => n.noticeId);
  notifications = createMemoryNotifications([], () => NOW, expired);
  notices = createMemoryNoticeStore({
    notifications,
    students: [STUDENT_A.id, STUDENT_B.id],
    staffNames: { [STAFF.id]: 'Officer One' },
  });
  const service = createNoticeService({ store: notices, now: () => NOW });
  return buildHarnessApp({
    notices: { service, store: notices, onPublished: () => (published += 1) },
    notifications: { inbox: notifications },
    now: () => NOW,
  });
}

beforeEach(() => {
  published = 0;
});

describe('inboxMessage', () => {
  test('the instructions follow the message', () => {
    expect(inboxMessage('Uniform week.', null)).toBe('Uniform week.');
    expect(inboxMessage('Uniform week.', 'Wear it daily.')).toBe('Uniform week.\n\nWhat to do: Wear it daily.');
  });
});

describe('POST /notices', () => {
  test('staff publish: one notice, one inbox notification per student, and the sweep is kicked', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff
      .post('/notices')
      .send({ title: 'Uniform inspection week', message: 'Inspection is Oct 12 to 17.', instructions: 'Wear the uniform.', expiresOn: '2026-10-17' });
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ noticeId: 1, recipients: 2 });
    expect(published).toBe(1);
    expect(notifications.rows).toHaveLength(2);
    expect(notifications.rows[0]).toMatchObject({
      kind: 'notice',
      title: 'Uniform inspection week',
      message: 'Inspection is Oct 12 to 17.\n\nWhat to do: Wear the uniform.',
      linkType: 'inbox',
      linkId: 1,
      idempotencyKey: `notice:1:${STUDENT_A.id}`,
    });
  });

  test.each([
    ['no title', { message: 'Text' }],
    ['a blank message', { title: 'T', message: '   ' }],
    ['a title over 120 characters', { title: 'x'.repeat(121), message: 'Text' }],
    ['a message over 1000 characters', { title: 'T', message: 'x'.repeat(1001) }],
    ['text that is not text', { title: 5, message: 'Text' }],
    ['an expiry in the past', { title: 'T', message: 'Text', expiresOn: '2026-10-11' }],
    ['an expiry that is not a date', { title: 'T', message: 'Text', expiresOn: 'tomorrow' }],
  ])('refuses %s and writes nothing', async (_label, body) => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.post('/notices').send(body);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_input');
    expect(notices.notices).toHaveLength(0);
    expect(notifications.rows).toHaveLength(0);
    expect(published).toBe(0);
  });

  test('students and signed-out visitors cannot publish or list notices', async () => {
    const app = build();
    expect((await request(app).post('/notices').send({ title: 'T', message: 'M' })).status).toBe(401);
    const student = await signedInAgent(app, STUDENT_A.email);
    expect((await student.post('/notices').send({ title: 'T', message: 'M' })).status).toBe(403);
    expect((await student.get('/notices')).status).toBe(403);
    expect((await student.delete('/notices/1')).status).toBe(403);
    expect(notices.notices).toHaveLength(0);
  });
});

describe('GET /notices', () => {
  test('lists newest first with the recipient count and whether each has expired', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    await staff.post('/notices').send({ title: 'Open', message: 'M', expiresOn: '2026-10-20' });
    await staff.post('/notices').send({ title: 'No expiry', message: 'M' });
    // An expired one, written straight into the store (the API refuses a past expiry).
    await notices.create({
      title: 'Old',
      message: 'M',
      instructions: null,
      expiresOn: '2026-10-01',
      employeeId: STAFF.id,
      date: new Date('2026-09-20T02:00:00Z'),
      inboxMessage: 'M',
    });
    const response = await staff.get('/notices');
    expect(response.status).toBe(200);
    expect(response.body.data.notices.map((n: { title: string; expired: boolean }) => [n.title, n.expired])).toEqual([
      ['Old', true],
      ['No expiry', false],
      ['Open', false],
    ]);
    expect(response.body.data.notices[0]).toMatchObject({ recipients: 2, createdBy: 'Officer One' });
  });
});

describe('PATCH and DELETE /notices/:id', () => {
  test('editing rewrites the notice and the notifications already sent', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    await staff.post('/notices').send({ title: 'Old title', message: 'Old text' });
    const response = await staff.patch('/notices/1').send({ title: 'New title', message: 'New text', instructions: 'Do it.' });
    expect(response.status).toBe(200);
    expect(notices.notices[0]).toMatchObject({ title: 'New title', instructions: 'Do it.' });
    expect(notifications.rows.every((row) => row.title === 'New title' && row.message === 'New text\n\nWhat to do: Do it.')).toBe(true);
  });

  test('removing deletes the notice and its notifications', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    await staff.post('/notices').send({ title: 'T', message: 'M' });
    expect((await staff.delete('/notices/1')).status).toBe(200);
    expect(notices.notices).toHaveLength(0);
    expect(notifications.rows).toHaveLength(0);
  });

  test('an unknown or malformed id is 404', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.patch('/notices/9').send({ title: 'T', message: 'M' })).status).toBe(404);
    expect((await staff.delete('/notices/9')).status).toBe(404);
    expect((await staff.delete('/notices/abc')).status).toBe(404);
  });
});

describe('a student sees notices in the inbox until they expire', () => {
  test('visible while open, hidden (and not counted unread) after the expiry day', async () => {
    const app = build();
    const staff = await signedInAgent(app, STAFF.email);
    await staff.post('/notices').send({ title: 'Clearance requirements', message: 'M', expiresOn: '2026-10-12' });
    const student = await signedInAgent(app, STUDENT_A.email);
    const open = await student.get('/me/notifications');
    expect(open.body.data.notifications.map((n: { title: string }) => n.title)).toEqual(['Clearance requirements']);
    expect(open.body.data.unreadCount).toBe(1);

    // The expiry day has passed.
    notices.notices[0].expiresOn = '2026-10-11';
    const closed = await student.get('/me/notifications');
    expect(closed.body.data.notifications).toEqual([]);
    expect(closed.body.data.unreadCount).toBe(0);
  });
});
