import { describe, expect, test } from 'vitest';
import { createMemoryClearanceStore } from '../../src/repositories/clearance/memory-store.js';
import { createClearanceService } from '../../src/services/clearance.service.js';
import { SYSTEM_EMPLOYEE_ID } from '../../src/domain/clearance/rules.js';

const S1 = '2025-0000001';
const S2 = '2025-0000002';
const S3 = '2026-0000003';
const NOW = new Date('2026-08-01T00:05:00Z');

function build(seed: Parameters<typeof createMemoryClearanceStore>[0] = {}) {
  const store = createMemoryClearanceStore({ students: [S1, S2, S3], employees: ['E001', SYSTEM_EMPLOYEE_ID], ...seed });
  const service = createClearanceService({ store, now: () => NOW });
  const run = (academicYear: unknown = 2026, semester: unknown = 1) =>
    service.setUpTerm({ employeeId: SYSTEM_EMPLOYEE_ID, academicYear, semester });
  return { store, service, run };
}

describe('setUpTerm (the automatic set-up when a term starts)', () => {
  test('gives every active student a pending clearance with the four standard items and one set_up log row', async () => {
    const { store, run } = build();
    expect(await run()).toEqual({ ok: true, activeStudents: 3, created: 3, skipped: 0 });
    expect(store.state.clearances.map((c) => c.studentId).sort()).toEqual([S1, S2, S3]);
    for (const clearance of store.state.clearances) {
      expect(clearance).toMatchObject({ academicYear: 2026, semester: 1, status: 'pending' });
      expect(clearance.items.map((entry) => entry.status)).toEqual(['pending', 'pending', 'pending', 'pending']);
    }
    expect(store.state.history).toHaveLength(3);
    expect(store.state.history.every((entry) => entry.eventType === 'set_up' && entry.employeeId === SYSTEM_EMPLOYEE_ID)).toBe(true);
    expect(store.state.history[0].remarks).toBe('Standard requirements set up automatically for 2026-2027, Semester 1.');
  });

  test('students who already have a clearance for the term are skipped and left untouched', async () => {
    const { store, service, run } = build();
    await service.setUp({ employeeId: 'E001', studentId: S1, academicYear: 2026, semester: 1 });
    const before = structuredClone(store.state.clearances[0]);

    expect(await run()).toEqual({ ok: true, activeStudents: 3, created: 2, skipped: 1 });
    expect(store.state.clearances[0]).toEqual(before);
    expect(store.state.clearances).toHaveLength(3);
  });

  test('running it twice is harmless: the second run creates nothing', async () => {
    const { store, run } = build();
    await run();
    expect(await run()).toEqual({ ok: true, activeStudents: 3, created: 0, skipped: 3 });
    expect(store.state.clearances).toHaveLength(3);
    expect(store.state.history).toHaveLength(3);
  });

  test('another term is a separate set of clearances', async () => {
    const { store, run } = build();
    await run(2026, 1);
    expect(await run(2026, 2)).toMatchObject({ ok: true, created: 3 });
    expect(store.state.clearances).toHaveLength(6);
  });

  test('sends no student notifications (only the manual checklist actions do)', async () => {
    const { store, run } = build();
    await run();
    expect(store.state.notifications).toEqual([]);
  });

  test.each([
    [26, 1],
    [2026, 0],
    [2026, 4],
    ['2026', 1],
    [2026, 1.5],
  ])('an invalid term (%s, %s) is refused and changes nothing', async (year, semester) => {
    const { store, run } = build();
    expect(await run(year, semester)).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(store.state.clearances).toEqual([]);
  });

  test('without the SYSTEM employee account it refuses with server_not_configured', async () => {
    const { store, run } = build({ employees: ['E001'] });
    expect(await run()).toMatchObject({ ok: false, code: 'server_not_configured' });
    expect(store.state.clearances).toEqual([]);
  });

  test('without default requirements it refuses and creates nothing', async () => {
    const { store, run } = build({ requirements: [{ requirementId: 9, label: 'Custom', isDefault: false }] });
    expect(await run()).toMatchObject({ ok: false, code: 'invalid_status' });
    expect(store.state.clearances).toEqual([]);
  });
});
