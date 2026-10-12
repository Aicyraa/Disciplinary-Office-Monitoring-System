import { beforeEach, describe, expect, test } from 'vitest';
import { createMemoryClearanceStore, type MemoryClearanceStore } from './memory-store.js';
import { createClearanceService, isUniqueViolation, type ClearanceService } from './service.js';
import type { ClearanceStore } from './types.js';

const STAFF = 'E001';
const S1 = '2025-0000001';
const NOW = new Date('2026-10-12T02:00:00Z');

let store: MemoryClearanceStore;
let service: ClearanceService;

beforeEach(() => {
  store = createMemoryClearanceStore({ students: [S1, '2025-0000002'] });
  service = createClearanceService({ store, now: () => NOW });
});

const setUp = (overrides: Partial<Parameters<ClearanceService['setUp']>[0]> = {}) =>
  service.setUp({ employeeId: STAFF, studentId: S1, academicYear: 2026, semester: 1, ...overrides });

const first = () => store.state.clearances[0];
const item = (requirementId: number) => first().items.find((entry) => entry.requirementId === requirementId)!;

describe('setUp (the "set up the 4 standard requirements" button)', () => {
  test('creates one pending clearance with the four default requirements, all pending, and logs set_up', async () => {
    expect(await setUp()).toEqual({ ok: true, clearanceId: 1 });
    expect(first()).toMatchObject({ studentId: S1, academicYear: 2026, semester: 1, status: 'pending' });
    expect(first().items.map((entry) => entry.label)).toEqual([
      'No active violations',
      'All sanctions served',
      'Guidance exit interview',
      'SDO signature',
    ]);
    expect(first().items.every((entry) => entry.status === 'pending')).toBe(true);
    expect(store.state.history).toEqual([
      expect.objectContaining({ clearanceId: 1, eventType: 'set_up', employeeId: STAFF, requirementId: null }),
    ]);
  });

  test('a second set up for the same student and term is refused and changes nothing', async () => {
    await setUp();
    await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId: 1, remarks: null });
    expect(await setUp()).toMatchObject({ ok: false, code: 'clearance_exists' });
    expect(first().items).toHaveLength(4);
    expect(item(1).status).toBe('completed');
  });

  test('another term or another student is fine', async () => {
    await setUp();
    expect(await setUp({ semester: 2 })).toMatchObject({ ok: true });
    expect(await setUp({ studentId: '2025-0000002' })).toMatchObject({ ok: true });
    expect(store.state.clearances).toHaveLength(3);
  });

  test.each([
    ['semester 0', { semester: 0 }],
    ['semester 4', { semester: 4 }],
    ['a three digit year', { academicYear: 202 }],
    ['a text year', { academicYear: '2026' as unknown as number }],
  ])('refuses %s', async (_label, override) => {
    expect(await setUp(override)).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(store.state.clearances).toHaveLength(0);
  });

  test('an unknown student is refused', async () => {
    expect(await setUp({ studentId: '2099-9999999' })).toMatchObject({ ok: false, code: 'student_not_found' });
  });

  test('set up sends no notification (only done, reversed and cleared do)', async () => {
    await setUp();
    expect(store.state.notifications).toHaveLength(0);
  });
});

describe('lost races', () => {
  test('a unique-key error from the database on set up is reported as clearance_exists, not thrown', async () => {
    const racing: ClearanceStore = {
      transaction: (work) =>
        store.transaction(async (tx) =>
          work({
            ...tx,
            insertClearance: async () => {
              throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
            },
          }),
        ),
    };
    const raced = createClearanceService({ store: racing, now: () => NOW });
    expect(await raced.setUp({ employeeId: STAFF, studentId: S1, academicYear: 2026, semester: 1 })).toMatchObject({
      ok: false,
      code: 'clearance_exists',
    });
    expect(store.state.clearances).toHaveLength(0);
  });

  test('a different database error is not swallowed', async () => {
    const broken: ClearanceStore = {
      transaction: (work) =>
        store.transaction(async (tx) =>
          work({
            ...tx,
            insertClearance: async () => {
              throw new Error('connection reset');
            },
          }),
        ),
    };
    const failing = createClearanceService({ store: broken, now: () => NOW });
    await expect(failing.setUp({ employeeId: STAFF, studentId: S1, academicYear: 2026, semester: 1 })).rejects.toThrow('connection reset');
  });
});

describe('isUniqueViolation', () => {
  test.each([
    [new Error('duplicate key value violates unique constraint "x"'), true],
    [Object.assign(new Error('x'), { code: 'P2002' }), true],
    [Object.assign(new Error('x'), { code: '23505' }), true],
    [{ cause: { originalCode: '23505' } }, true],
    [new Error('connection reset'), false],
    ['a string', false],
  ])('%#', (error, expected) => {
    expect(isUniqueViolation(error)).toBe(expected);
  });
});

describe('markDone', () => {
  beforeEach(async () => {
    await setUp();
  });

  test('completes one item, records who and when, logs it and tells the student; the clearance stays pending', async () => {
    expect(await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId: 2, remarks: 'Served 10 hours' })).toEqual({
      ok: true,
      cleared: false,
    });
    expect(item(2)).toMatchObject({
      status: 'completed',
      remarks: 'Served 10 hours',
      completedByEmployeeId: STAFF,
      dateCompleted: NOW,
    });
    expect(first().status).toBe('pending');
    expect(store.state.history.at(-1)).toMatchObject({ eventType: 'marked_done', requirementId: 2, employeeId: STAFF });
    expect(store.state.notifications).toHaveLength(1);
    expect(store.state.notifications[0]).toMatchObject({ studentId: S1, clearanceId: 1 });
    expect(store.state.notifications[0].title).toContain('All sanctions served');
  });

  test('marking the last pending item clears the clearance and sends one "cleared" notification', async () => {
    for (const requirementId of [1, 2, 3]) {
      await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId, remarks: null });
    }
    expect(first().status).toBe('pending');
    const last = await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId: 4, remarks: null });
    expect(last).toEqual({ ok: true, cleared: true });
    expect(first().status).toBe('cleared');
    expect(store.state.notifications).toHaveLength(4); // 3 "done" + 1 "cleared", not 5
    expect(store.state.notifications.at(-1)?.title).toMatch(/cleared/i);
    expect(store.state.notifications.at(-1)?.idempotencyKey).toMatch(/^clr:1:cleared:/);
  });

  test('an item that is already done cannot be marked again', async () => {
    await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId: 1, remarks: null });
    expect(await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId: 1, remarks: null })).toMatchObject({
      ok: false,
      code: 'invalid_status',
    });
    expect(store.state.history.filter((h) => h.eventType === 'marked_done')).toHaveLength(1);
  });

  test('remarks are optional and capped at 1000 characters', async () => {
    expect(await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId: 1, remarks: '  ' })).toMatchObject({ ok: true });
    expect(item(1).remarks).toBeNull();
    expect(
      await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId: 2, remarks: 'x'.repeat(1001) }),
    ).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(item(2).status).toBe('pending');
  });

  test('an unknown clearance or requirement is not found', async () => {
    expect(await service.markDone({ employeeId: STAFF, clearanceId: 9, requirementId: 1, remarks: null })).toMatchObject({
      code: 'not_found',
    });
    expect(await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId: 99, remarks: null })).toMatchObject({
      code: 'not_found',
    });
  });
});

describe('reverse (reason required)', () => {
  beforeEach(async () => {
    await setUp();
    await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId: 1, remarks: 'ok' });
  });

  test('needs a reason', async () => {
    expect(await service.reverse({ employeeId: STAFF, clearanceId: 1, requirementId: 1, reason: '  ' })).toMatchObject({
      ok: false,
      code: 'invalid_input',
    });
    expect(await service.reverse({ employeeId: STAFF, clearanceId: 1, requirementId: 1, reason: 'x'.repeat(1001) })).toMatchObject({
      code: 'invalid_input',
    });
    expect(item(1).status).toBe('completed');
  });

  test('puts the item back to pending, clears who and when, logs the reason and tells the student', async () => {
    expect(await service.reverse({ employeeId: STAFF, clearanceId: 1, requirementId: 1, reason: 'New violation recorded' })).toEqual({
      ok: true,
    });
    expect(item(1)).toMatchObject({ status: 'pending', remarks: null, completedByEmployeeId: null, dateCompleted: null });
    expect(store.state.history.at(-1)).toMatchObject({ eventType: 'reversed', remarks: 'New violation recorded', requirementId: 1 });
    expect(store.state.notifications.at(-1)?.message).toContain('New violation recorded');
  });

  test('reversing an item of a cleared clearance makes it pending again', async () => {
    for (const requirementId of [2, 3, 4]) {
      await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId, remarks: null });
    }
    expect(first().status).toBe('cleared');
    await service.reverse({ employeeId: STAFF, clearanceId: 1, requirementId: 3, reason: 'Interview not held' });
    expect(first().status).toBe('pending');
    expect(store.state.notifications.at(-1)?.message).toMatch(/pending/i);
  });

  test('an item that is not done cannot be reversed', async () => {
    expect(await service.reverse({ employeeId: STAFF, clearanceId: 1, requirementId: 2, reason: 'Why' })).toMatchObject({
      ok: false,
      code: 'invalid_status',
    });
  });
});

describe('custom items', () => {
  beforeEach(async () => {
    await setUp();
  });

  test('add creates a custom requirement, links it as pending and logs requirement_added (no notification)', async () => {
    const before = store.state.notifications.length;
    const result = await service.addRequirement({ employeeId: STAFF, clearanceId: 1, label: '  Library clearance ' });
    expect(result).toMatchObject({ ok: true });
    expect(first().items.at(-1)).toMatchObject({ label: 'Library clearance', status: 'pending' });
    expect(store.state.requirements.find((r) => r.label === 'Library clearance')).toMatchObject({ isDefault: false });
    expect(store.state.history.at(-1)).toMatchObject({ eventType: 'requirement_added', employeeId: STAFF });
    expect(store.state.notifications).toHaveLength(before);
  });

  test('adding a label that already exists reuses the requirement; adding it twice to one clearance is refused', async () => {
    await service.addRequirement({ employeeId: STAFF, clearanceId: 1, label: 'Library clearance' });
    await service.setUp({ employeeId: STAFF, studentId: '2025-0000002', academicYear: 2026, semester: 1 });
    expect(await service.addRequirement({ employeeId: STAFF, clearanceId: 2, label: 'library clearance' })).toMatchObject({ ok: true });
    expect(store.state.requirements.filter((r) => r.label.toLowerCase() === 'library clearance')).toHaveLength(1);
    expect(await service.addRequirement({ employeeId: STAFF, clearanceId: 1, label: 'LIBRARY CLEARANCE' })).toMatchObject({
      ok: false,
      code: 'requirement_exists',
    });
  });

  test('a standard label cannot be added twice either', async () => {
    expect(await service.addRequirement({ employeeId: STAFF, clearanceId: 1, label: 'SDO signature' })).toMatchObject({
      code: 'requirement_exists',
    });
  });

  test('a label is required and capped at 200 characters', async () => {
    expect(await service.addRequirement({ employeeId: STAFF, clearanceId: 1, label: '   ' })).toMatchObject({ code: 'invalid_input' });
    expect(await service.addRequirement({ employeeId: STAFF, clearanceId: 1, label: 'x'.repeat(201) })).toMatchObject({
      code: 'invalid_input',
    });
  });

  test('adding an item to a cleared clearance makes it pending again', async () => {
    for (const requirementId of [1, 2, 3, 4]) {
      await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId, remarks: null });
    }
    expect(first().status).toBe('cleared');
    await service.addRequirement({ employeeId: STAFF, clearanceId: 1, label: 'Library clearance' });
    expect(first().status).toBe('pending');
  });

  test('removing an item logs requirement_removed; if the rest are all done the clearance becomes cleared', async () => {
    for (const requirementId of [1, 2, 3]) {
      await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId, remarks: null });
    }
    const removed = await service.removeRequirement({ employeeId: STAFF, clearanceId: 1, requirementId: 4 });
    expect(removed).toEqual({ ok: true, cleared: true });
    expect(first().items).toHaveLength(3);
    expect(first().status).toBe('cleared');
    expect(store.state.history.some((h) => h.eventType === 'requirement_removed' && h.requirementId === 4)).toBe(true);
    expect(store.state.notifications.at(-1)?.title).toMatch(/cleared/i);
  });

  test('the last remaining item cannot be removed (a clearance needs a checklist)', async () => {
    for (const requirementId of [2, 3, 4]) {
      await service.removeRequirement({ employeeId: STAFF, clearanceId: 1, requirementId });
    }
    expect(await service.removeRequirement({ employeeId: STAFF, clearanceId: 1, requirementId: 1 })).toMatchObject({
      ok: false,
      code: 'invalid_status',
    });
    expect(first().items).toHaveLength(1);
  });

  test('removing something that is not on the clearance is not found', async () => {
    expect(await service.removeRequirement({ employeeId: STAFF, clearanceId: 1, requirementId: 77 })).toMatchObject({
      code: 'not_found',
    });
  });
});

describe('no automatic checking', () => {
  test('open cases never complete or block anything: only staff actions change an item', async () => {
    store = createMemoryClearanceStore({ students: [S1], openCases: { [S1]: 3 } });
    service = createClearanceService({ store, now: () => NOW });
    await setUp();
    expect(first().items.every((entry) => entry.status === 'pending')).toBe(true);
    expect(await service.markDone({ employeeId: STAFF, clearanceId: 1, requirementId: 1, remarks: null })).toMatchObject({ ok: true });
  });
});
