import { beforeEach, describe, expect, test } from 'vitest';
import { createMemoryGateStore, type MemoryGateStore } from './memory-store.js';
import { createGateService, type GateService } from './service.js';
import type { ParsedReport } from './validate.js';

const NOW = new Date('2026-10-12T02:00:00Z'); // Monday 10:00 in Manila
let store: MemoryGateStore;
let service: GateService;
let counter = 0;

beforeEach(() => {
  counter = 0;
  store = createMemoryGateStore({ students: ['2025-1030808'] });
  service = createGateService({
    store,
    now: () => NOW,
    newReference: () => `00000000-0000-4000-8000-00000000000${(counter += 1)}`,
  });
});

const report = (overrides: Partial<ParsedReport> = {}): ParsedReport => ({
  studentId: '2025-1030808',
  name: 'Ana Cruz',
  program: 'BS Computer Science',
  year: '3rd year',
  violationIds: [1, 2],
  ...overrides,
});

describe('submit', () => {
  test('one gate case per violation, sharing one reference, with the typed values kept', async () => {
    const result = await service.submit(report());
    expect(result).toEqual({ ok: true, reference: '00000000-0000-4000-8000-000000000001', duplicate: false });
    expect(store.state.cases).toHaveLength(2);
    expect(store.state.cases[0]).toMatchObject({
      studentId: '2025-1030808',
      handbookEntryId: 1,
      claimedStudentId: '2025-1030808',
      claimedName: 'Ana Cruz',
      claimedProgram: 'BS Computer Science',
      claimedYear: '3rd year',
      submissionRef: '00000000-0000-4000-8000-000000000001',
      caseDate: NOW,
    });
    expect(new Set(store.state.cases.map((c) => c.submissionRef)).size).toBe(1);
    expect(store.state.history).toHaveLength(2);
  });

  test('a matched student gets one notification and staff get one alert, both once per submission', async () => {
    await service.submit(report());
    const keys = store.state.notifications.map((n) => n.idempotencyKey);
    expect(keys).toEqual([
      'report:00000000-0000-4000-8000-000000000001:student',
      'report:00000000-0000-4000-8000-000000000001:staff',
    ]);
    const [student, staff] = store.state.notifications;
    expect(student).toMatchObject({ recipient: 'student', studentId: '2025-1030808' });
    expect(student.message).toContain('Improper uniform');
    expect(student.message).toContain('No ID');
    expect(staff).toMatchObject({ recipient: 'staff', studentId: null });
    expect(staff.message).toContain('Ana Cruz');
  });

  test('an ID that is not on file keeps student_id empty, tells staff so, and notifies no student', async () => {
    const result = await service.submit(report({ studentId: '2025-9999999' }));
    expect(result).toMatchObject({ ok: true, duplicate: false });
    expect(store.state.cases.every((c) => c.studentId === null && c.claimedStudentId === '2025-9999999')).toBe(true);
    expect(store.state.notifications).toHaveLength(1);
    expect(store.state.notifications[0]).toMatchObject({ recipient: 'staff' });
    expect(store.state.notifications[0].message).toMatch(/not on file/i);
  });

  test('a typed name that differs from the account is kept as typed (never compared)', async () => {
    await service.submit(report({ name: 'Somebody Else' }));
    expect(store.state.cases[0].claimedName).toBe('Somebody Else');
    expect(store.state.cases[0].studentId).toBe('2025-1030808');
  });

  test.each([
    ['an unknown program', { program: 'BS Underwater Basket Weaving' }],
    ['an unknown violation', { violationIds: [1, 999] }],
    ['the system violation', { violationIds: [68] }],
  ])('refuses %s and writes nothing', async (_label, override) => {
    expect(await service.submit(report(override))).toEqual({ ok: false });
    expect(store.state.cases).toHaveLength(0);
    expect(store.state.notifications).toHaveLength(0);
  });
});

describe('duplicates (same typed ID + violation + Manila day)', () => {
  test('the same report again returns the first reference and writes nothing', async () => {
    const first = await service.submit(report());
    const again = await service.submit(report());
    expect(again).toEqual({ ok: true, reference: first.ok ? first.reference : '', duplicate: true });
    expect(store.state.cases).toHaveLength(2);
    expect(store.state.notifications).toHaveLength(2);
  });

  test('a mix of a repeated and a new violation files only the new one, under a new reference', async () => {
    await service.submit(report({ violationIds: [1] }));
    const second = await service.submit(report({ violationIds: [1, 2] }));
    expect(second).toEqual({ ok: true, reference: '00000000-0000-4000-8000-000000000002', duplicate: false });
    expect(store.state.cases.map((c) => c.handbookEntryId)).toEqual([1, 2]);
  });

  test('the next Manila day is a new report', async () => {
    await service.submit(report({ violationIds: [1] }));
    const tomorrow = createGateService({
      store,
      now: () => new Date('2026-10-13T02:00:00Z'),
      newReference: () => '00000000-0000-4000-8000-0000000000aa',
    });
    expect(await tomorrow.submit(report({ violationIds: [1] }))).toMatchObject({ ok: true, duplicate: false });
    expect(store.state.cases).toHaveLength(2);
  });

  test('a lost race on the unique index is answered as the existing report, not a failure', async () => {
    // Another request already filed the same case, but our first check does not see it (it ran just before
    // that request committed). The unique index refuses our insert; the answer is the existing reference.
    const first = await service.submit(report({ violationIds: [1] }));
    let blind = true;
    const racing = createGateService({
      store: {
        transaction: (work) =>
          store.transaction((tx) =>
            work({
              ...tx,
              findTodaysDuplicates: async (...args) => {
                if (blind) {
                  blind = false;
                  return [];
                }
                return tx.findTodaysDuplicates(...args);
              },
            }),
          ),
      },
      now: () => NOW,
      newReference: () => '00000000-0000-4000-8000-0000000000bb',
    });
    const result = await racing.submit(report({ violationIds: [1] }));
    expect(result).toEqual({ ok: true, reference: first.ok ? first.reference : '', duplicate: true });
    expect(store.state.cases).toHaveLength(1);
    expect(store.state.notifications).toHaveLength(2); // nothing new was notified
  });
});
