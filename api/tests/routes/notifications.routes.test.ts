import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createMemoryCaseStore } from '../../src/repositories/cases/memory-store.js';
import { createCaseService } from '../../src/services/cases.service.js';
import type { CaseRecord } from '../../src/types/cases.types.js';
import {
  buildHarnessApp,
  signedInAgent,
  STAFF,
  STAFF_TEMP,
  STUDENT_A,
  STUDENT_B,
  STUDENT_TEMP,
} from '../helpers/harness.js';
import { withAfterCommit } from '../../src/services/notifications/after-commit.js';
import { createMemoryNotifications, type MemoryNotification } from '../../src/repositories/notifications/memory.js';

const at = (minute: number) => new Date(Date.UTC(2026, 9, 12, 2, minute));

const note = (overrides: Partial<MemoryNotification> & { notificationId: number }): MemoryNotification => ({
  recipientType: 'student',
  studentId: STUDENT_A.id,
  kind: 'case',
  title: `Title ${overrides.notificationId}`,
  message: `Message ${overrides.notificationId}`,
  linkType: 'case',
  linkId: overrides.notificationId,
  idempotencyKey: `k${overrides.notificationId}`,
  isRead: false,
  dateCreated: at(overrides.notificationId),
  ...overrides,
});

let notifications: ReturnType<typeof createMemoryNotifications>;

const app = () => buildHarnessApp({ notifications: { inbox: notifications } });

beforeEach(() => {
  notifications = createMemoryNotifications([
    note({ notificationId: 1 }),
    note({ notificationId: 2, kind: 'sanction', linkType: 'sanction', linkId: 9 }),
    note({ notificationId: 3, isRead: true }),
    note({ notificationId: 4, studentId: STUDENT_B.id, title: 'B only' }),
    note({ notificationId: 5, recipientType: 'staff', studentId: null, kind: 'sanction', title: 'Proof submitted', linkType: 'case', linkId: 12 }),
    note({ notificationId: 6, recipientType: 'staff', studentId: null, kind: 'report', title: 'New report', linkType: 'case', linkId: 13, isRead: true }),
  ]);
});

describe('access control', () => {
  const studentPaths: Array<[string, string]> = [
    ['get', '/me/notifications'],
    ['post', '/me/notifications/1/read'],
    ['post', '/me/notifications/read-all'],
  ];
  const staffPaths: Array<[string, string]> = [
    ['get', '/notifications'],
    ['post', '/notifications/5/read'],
    ['post', '/notifications/read-all'],
  ];
  const call = (agent: unknown, method: string, path: string) =>
    (agent as Record<string, (p: string) => request.Test>)[method](path);

  test.each([...studentPaths, ...staffPaths])('%s %s is 401 without a session', async (method, path) => {
    expect((await call(request(app()), method, path)).status).toBe(401);
  });

  test.each(studentPaths)('%s %s is 403 for staff', async (method, path) => {
    const agent = await signedInAgent(app(), STAFF.email);
    expect((await call(agent, method, path)).status).toBe(403);
  });

  test.each(staffPaths)('%s %s is 403 for a student', async (method, path) => {
    const agent = await signedInAgent(app(), STUDENT_A.email);
    expect((await call(agent, method, path)).status).toBe(403);
  });

  test('accounts that must change their password are blocked', async () => {
    const student = await signedInAgent(app(), STUDENT_TEMP.email);
    const staff = await signedInAgent(app(), STAFF_TEMP.email);
    for (const response of [await student.get('/me/notifications'), await staff.get('/notifications')]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('password_change_required');
    }
  });
});

describe('student inbox', () => {
  test("lists only the signed-in student's notifications, newest first, with the unread count and page links", async () => {
    const agent = await signedInAgent(app(), STUDENT_A.email);
    const response = await agent.get('/me/notifications');
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.unreadCount).toBe(2);
    expect(response.body.data.notifications.map((n: { id: number }) => n.id)).toEqual([3, 2, 1]);
    const byId = (id: number) => response.body.data.notifications.find((n: { id: number }) => n.id === id);
    expect(byId(1).href).toBe('/violations/1');
    expect(byId(2).href).toBe('/sanctions');
    expect(JSON.stringify(response.body)).not.toContain('B only');
  });

  test('never exposes recipient, student id or idempotency key', async () => {
    const agent = await signedInAgent(app(), STUDENT_A.email);
    const text = JSON.stringify((await agent.get('/me/notifications')).body);
    expect(text).not.toMatch(/studentId|student_id|idempotency|recipient|2025-0000/i);
  });

  test('unread=true returns only unread; limit bounds the list', async () => {
    const agent = await signedInAgent(app(), STUDENT_A.email);
    const unread = await agent.get('/me/notifications?unread=true');
    expect(unread.body.data.notifications.map((n: { id: number }) => n.id)).toEqual([2, 1]);
    const one = await agent.get('/me/notifications?limit=1');
    expect(one.body.data.notifications).toHaveLength(1);
    expect(one.body.data.unreadCount).toBe(2);
  });

  test.each(['limit=0', 'limit=abc', 'limit=1000', 'unread=maybe'])('rejects %s with 400', async (query) => {
    const agent = await signedInAgent(app(), STUDENT_A.email);
    const response = await agent.get(`/me/notifications?${query}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('invalid_input');
  });

  test('marking one read lowers the unread count', async () => {
    const agent = await signedInAgent(app(), STUDENT_A.email);
    const response = await agent.post('/me/notifications/1/read');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ unreadCount: 1 });
    expect(notifications.rows.find((n) => n.notificationId === 1)?.isRead).toBe(true);
  });

  test("another student's notification is a 404 identical to a missing one, and is left unread", async () => {
    const agent = await signedInAgent(app(), STUDENT_A.email);
    const other = await agent.post('/me/notifications/4/read');
    const missing = await agent.post('/me/notifications/999/read');
    expect(other.status).toBe(404);
    expect(other.body).toEqual(missing.body);
    expect(notifications.rows.find((n) => n.notificationId === 4)?.isRead).toBe(false);
  });

  test("a staff notification id is not reachable through the student's route", async () => {
    const agent = await signedInAgent(app(), STUDENT_A.email);
    expect((await agent.post('/me/notifications/5/read')).status).toBe(404);
  });

  test.each(['abc', '1.5', '-1', '0x1'])('a malformed id %s is a 404', async (id) => {
    const agent = await signedInAgent(app(), STUDENT_A.email);
    expect((await agent.post(`/me/notifications/${id}/read`)).status).toBe(404);
  });

  test('read-all marks only this student\'s notifications', async () => {
    const agent = await signedInAgent(app(), STUDENT_A.email);
    const response = await agent.post('/me/notifications/read-all');
    expect(response.body.data).toEqual({ unreadCount: 0 });
    expect(notifications.rows.find((n) => n.notificationId === 4)?.isRead).toBe(false);
    expect(notifications.rows.find((n) => n.notificationId === 5)?.isRead).toBe(false);
  });
});

describe('staff shared inbox', () => {
  test('lists the staff rows, with links to the case page, and never a student row', async () => {
    const agent = await signedInAgent(app(), STAFF.email);
    const response = await agent.get('/notifications');
    expect(response.status).toBe(200);
    expect(response.body.data.notifications.map((n: { id: number }) => n.id)).toEqual([6, 5]);
    expect(response.body.data.unreadCount).toBe(1);
    expect(response.body.data.notifications.find((n: { id: number }) => n.id === 5).href).toBe('/cases/12');
    expect(JSON.stringify(response.body)).not.toContain('B only');
  });

  test('it is one shared inbox: reading a notification marks it read for every staff member', async () => {
    const agent = await signedInAgent(app(), STAFF.email);
    expect((await agent.post('/notifications/5/read')).body.data).toEqual({ unreadCount: 0 });
    const again = await signedInAgent(app(), STAFF.email);
    expect((await again.get('/notifications?unread=true')).body.data.notifications).toEqual([]);
  });

  test('a student notification is a 404 through the staff route', async () => {
    const agent = await signedInAgent(app(), STAFF.email);
    expect((await agent.post('/notifications/1/read')).status).toBe(404);
  });
});

describe('password reset notification', () => {
  test('staff reset calls the notification hook with the student id and never the temporary password', async () => {
    const onPasswordReset = vi.fn(async () => undefined);
    const built = buildHarnessApp({ onPasswordReset });
    const staff = await signedInAgent(built, STAFF.email);
    const response = await staff.post(`/staff/students/${STUDENT_A.id}/reset-password`);
    expect(response.status).toBe(200);
    expect(onPasswordReset).toHaveBeenCalledTimes(1);
    expect(onPasswordReset).toHaveBeenCalledWith(STUDENT_A.id);
    expect(JSON.stringify(onPasswordReset.mock.calls)).not.toContain(response.body.data.tempPassword);
  });

  test('a failing hook is logged and the reset still succeeds with its temporary password', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const built = buildHarnessApp({
      onPasswordReset: async () => {
        throw new Error('db down');
      },
    });
    const staff = await signedInAgent(built, STAFF.email);
    const response = await staff.post(`/staff/students/${STUDENT_A.id}/reset-password`);
    expect(response.status).toBe(200);
    expect(response.body.data.tempPassword).toMatch(/^Temp-\d{4}$/);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  test('an unknown student does not trigger the hook', async () => {
    const onPasswordReset = vi.fn(async () => undefined);
    const staff = await signedInAgent(buildHarnessApp({ onPasswordReset }), STAFF.email);
    expect((await staff.post('/staff/students/2025-9999999/reset-password')).status).toBe(404);
    expect(onPasswordReset).not.toHaveBeenCalled();
  });
});

describe('commit first, notify second (withAfterCommit)', () => {
  function seedCase(store: ReturnType<typeof createMemoryCaseStore>, caseId: number, overrides: Partial<CaseRecord> = {}) {
    store.state.cases.push({
      caseId,
      caseDate: at(caseId),
      status: 'reported',
      severity: 'Minor',
      isEscalated: false,
      studentId: STUDENT_A.id,
      handbookEntryId: 1,
      originalHandbookEntryId: null,
      source: 'gate',
      reportedByEmployeeId: null,
      claimedStudentId: STUDENT_A.id,
      claimedName: 'Ana',
      submissionRef: '11111111-1111-4111-8111-111111111111',
      resolvedWithoutSanction: false,
      dateResolved: null,
      ...overrides,
    });
  }

  test('the delivery kick happens after a committed transaction, after the notification row exists', async () => {
    const store = createMemoryCaseStore({
      students: new Set([STUDENT_A.id]),
      handbook: [{ handbookEntryId: 1, violationType: 'Improper uniform', severity: 'Minor', isSystem: false }],
    });
    seedCase(store, 1);
    const seenAtKick: number[] = [];
    const kick = vi.fn(() => seenAtKick.push(store.state.notifications.length));
    const service = createCaseService({ store: withAfterCommit(store, kick), now: () => at(30) });

    await service.validateSubmission({ employeeId: STAFF.id, submissionRef: '11111111-1111-4111-8111-111111111111' });
    expect(kick).toHaveBeenCalledTimes(1);
    expect(seenAtKick).toEqual([1]); // the row was already committed when delivery was asked for
  });

  test('no kick when the transaction fails: nothing was committed, so nothing is delivered', async () => {
    const store = createMemoryCaseStore({
      students: new Set([STUDENT_A.id]),
      handbook: [{ handbookEntryId: 1, violationType: 'Improper uniform', severity: 'Minor', isSystem: false }],
    });
    seedCase(store, 1);
    store.failAfterWrites(0);
    const kick = vi.fn();
    const service = createCaseService({ store: withAfterCommit(store, kick), now: () => at(30) });
    await expect(
      service.validateSubmission({ employeeId: STAFF.id, submissionRef: '11111111-1111-4111-8111-111111111111' }),
    ).rejects.toThrow(/simulated failure/);
    expect(kick).not.toHaveBeenCalled();
    expect(store.state.notifications).toEqual([]);
  });
});
