import { beforeEach, describe, expect, test } from 'vitest';
import { createMemoryAppointmentStore, type MemoryAppointmentStore } from './memory-store.js';
import { createAppointmentService, type AppointmentService } from './service.js';

const STAFF = 'E001';
const S1 = '2025-0000001';
const NOW = new Date('2026-10-12T02:00:00Z'); // Monday 2026-10-12 10:00 in Manila
const TODAY = '2026-10-12';

let store: MemoryAppointmentStore;
let service: AppointmentService;

beforeEach(() => {
  store = createMemoryAppointmentStore({ students: [S1, '2025-0000002'] });
  service = createAppointmentService({ store, now: () => NOW });
});

const create = (overrides: Partial<Parameters<AppointmentService['create']>[0]> = {}) =>
  service.create({
    employeeId: STAFF,
    studentId: S1,
    startDate: '2026-10-13',
    purpose: 'Guidance interview',
    notes: null,
    today: TODAY,
    ...overrides,
  });

const only = () => store.state.appointments[0];

describe('create', () => {
  test('stores a scheduled appointment with the computed end date, history and one student notification', async () => {
    const result = await create({ notes: 'Bring your ID' });
    expect(result).toEqual({ ok: true, appointmentId: 1 });
    expect(only()).toMatchObject({
      studentId: S1,
      employeeId: STAFF,
      startDate: '2026-10-13',
      endDate: '2026-10-19', // Tue + 5 working days, the Sunday skipped
      purpose: 'Guidance interview',
      notes: 'Bring your ID',
      status: 'scheduled',
    });
    expect(store.state.history).toEqual([
      expect.objectContaining({ appointmentId: 1, eventType: 'assigned', employeeId: STAFF }),
    ]);
    expect(store.state.notifications).toHaveLength(1);
    expect(store.state.notifications[0]).toMatchObject({ studentId: S1, appointmentId: 1, idempotencyKey: 'appt:1:new' });
    expect(store.state.notifications[0].message).toContain('7:00 AM');
  });

  test('the end date is never typed by the client: only start, purpose and notes are inputs', async () => {
    await create({ startDate: '2026-10-12' });
    expect(only().endDate).toBe('2026-10-17');
  });

  test.each([
    ['yesterday', '2026-10-11', 'invalid_date'],
    ['a Sunday', '2026-10-18', 'invalid_date'],
    ['more than 60 days ahead', '2026-12-12', 'invalid_date'],
    ['not a date', '13/10/2026', 'invalid_date'],
  ])('refuses a start date that is %s', async (_label, startDate, code) => {
    expect(await create({ startDate })).toMatchObject({ ok: false, code });
    expect(store.state.appointments).toHaveLength(0);
    expect(store.state.notifications).toHaveLength(0);
  });

  test('accepts today and the 60th day', async () => {
    expect(await create({ startDate: '2026-10-12' })).toMatchObject({ ok: true });
    expect(await create({ studentId: '2025-0000002', startDate: '2026-12-11' })).toMatchObject({ ok: true });
  });

  test('a purpose is required and capped at 1000 characters; notes are optional and capped too', async () => {
    expect(await create({ purpose: '   ' })).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(await create({ purpose: 'x'.repeat(1001) })).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(await create({ notes: 'y'.repeat(1001) })).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(await create({ purpose: 'x'.repeat(1000), notes: '  ' })).toMatchObject({ ok: true });
    expect(only().notes).toBeNull();
  });

  test('an unknown student is refused', async () => {
    expect(await create({ studentId: '2099-9999999' })).toMatchObject({ ok: false, code: 'student_not_found' });
  });

  test('an overlapping live window for the same student is refused, another student is fine', async () => {
    await create({ startDate: '2026-10-13' });
    const clash = await create({ startDate: '2026-10-15' });
    expect(clash).toMatchObject({ ok: false, code: 'appointment_overlap' });
    if (!clash.ok) expect(clash.message).toMatch(/Oct 13/);
    expect(await create({ studentId: '2025-0000002', startDate: '2026-10-15' })).toMatchObject({ ok: true });
    expect(store.state.appointments).toHaveLength(2);
  });

  test('a window that starts the day after another one ends is allowed', async () => {
    await create({ startDate: '2026-10-12' }); // ends Sat 2026-10-17
    expect(await create({ startDate: '2026-10-19' })).toMatchObject({ ok: true }); // Mon
  });

  test('completed and cancelled appointments do not block a new window', async () => {
    await create({ startDate: '2026-10-13' });
    await service.cancel({ employeeId: STAFF, appointmentId: 1, reason: 'Student unwell' });
    expect(await create({ startDate: '2026-10-14' })).toMatchObject({ ok: true });
  });

  test('if another writer wins the race, the database constraint is reported as an overlap, not a 500', async () => {
    store.onNextWrite((state) => {
      state.appointments.push({
        appointmentId: 99,
        studentId: S1,
        employeeId: STAFF,
        startDate: '2026-10-14',
        endDate: '2026-10-20',
        purpose: 'Raced in',
        notes: null,
        status: 'scheduled',
        cancelReason: null,
        dateCreated: NOW,
      });
    });
    expect(await create({ startDate: '2026-10-13' })).toMatchObject({ ok: false, code: 'appointment_overlap' });
    // The failed transaction wrote nothing.
    expect(store.state.appointments).toHaveLength(0);
    expect(store.state.history).toHaveLength(0);
    expect(store.state.notifications).toHaveLength(0);
  });
});

describe('update (reschedule or change purpose and notes)', () => {
  beforeEach(async () => {
    await create({ startDate: '2026-10-13' });
  });

  const update = (input: Partial<Parameters<AppointmentService['update']>[0]>) =>
    service.update({ employeeId: STAFF, appointmentId: 1, today: TODAY, ...input });

  test('a new start date makes it rescheduled, recomputes the end date, logs it and notifies', async () => {
    expect(await update({ startDate: '2026-10-15' })).toEqual({ ok: true });
    expect(only()).toMatchObject({ status: 'rescheduled', startDate: '2026-10-15', endDate: '2026-10-21' });
    expect(store.state.history.at(-1)).toMatchObject({ eventType: 'rescheduled', employeeId: STAFF });
    expect(store.state.history.at(-1)?.remarks).toMatch(/Oct 13.*Oct 15/);
    expect(store.state.notifications).toHaveLength(2);
    expect(store.state.notifications[1].idempotencyKey).toMatch(/^appt:1:rescheduled:/);
  });

  test('changing the purpose or notes only is a remarks update: status stays, still logged and notified', async () => {
    expect(await update({ purpose: 'Exit interview', notes: 'Room 2' })).toEqual({ ok: true });
    expect(only()).toMatchObject({ status: 'scheduled', purpose: 'Exit interview', notes: 'Room 2', startDate: '2026-10-13' });
    expect(store.state.history.at(-1)).toMatchObject({ eventType: 'remarks_updated' });
    expect(store.state.notifications).toHaveLength(2);
  });

  test('the same start date is not a reschedule', async () => {
    expect(await update({ startDate: '2026-10-13' })).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(only().status).toBe('scheduled');
  });

  test('nothing to change is refused', async () => {
    expect(await update({})).toMatchObject({ ok: false, code: 'invalid_input' });
  });

  test('the new start date follows the same rules as a new appointment', async () => {
    expect(await update({ startDate: '2026-10-18' })).toMatchObject({ ok: false, code: 'invalid_date' }); // Sunday
    expect(await update({ startDate: '2026-10-10' })).toMatchObject({ ok: false, code: 'invalid_date' }); // past
    expect(only().startDate).toBe('2026-10-13');
  });

  test('a reschedule into another live window of the same student is refused; moving over itself is fine', async () => {
    await create({ startDate: '2026-10-26' }); // id 2, ends Sat 2026-10-31
    expect(await update({ startDate: '2026-10-26' })).toMatchObject({ ok: false, code: 'appointment_overlap' });
    expect(await update({ startDate: '2026-10-14' })).toEqual({ ok: true }); // overlaps only its own old window
  });

  test('a completed or cancelled appointment cannot be changed', async () => {
    await service.complete({ employeeId: STAFF, appointmentId: 1 });
    expect(await update({ startDate: '2026-10-15' })).toMatchObject({ ok: false, code: 'invalid_status' });
  });

  test('an unknown appointment is not found', async () => {
    expect(await update({ appointmentId: 42, purpose: 'x' })).toMatchObject({ ok: false, code: 'not_found' });
  });

  test('a rescheduled appointment can be rescheduled again', async () => {
    await update({ startDate: '2026-10-15' });
    expect(await update({ startDate: '2026-10-16' })).toEqual({ ok: true });
    expect(only()).toMatchObject({ status: 'rescheduled', startDate: '2026-10-16' });
  });
});

describe('complete and cancel', () => {
  beforeEach(async () => {
    await create();
  });

  test('complete marks it completed, logs and notifies', async () => {
    expect(await service.complete({ employeeId: STAFF, appointmentId: 1 })).toEqual({ ok: true });
    expect(only().status).toBe('completed');
    expect(store.state.history.at(-1)).toMatchObject({ eventType: 'completed' });
    expect(store.state.notifications.at(-1)).toMatchObject({ idempotencyKey: 'appt:1:completed' });
  });

  test('complete only works on a live appointment', async () => {
    await service.complete({ employeeId: STAFF, appointmentId: 1 });
    expect(await service.complete({ employeeId: STAFF, appointmentId: 1 })).toMatchObject({ ok: false, code: 'invalid_status' });
  });

  test('cancel needs a reason, stores it, logs it and tells the student why', async () => {
    expect(await service.cancel({ employeeId: STAFF, appointmentId: 1, reason: '  ' })).toMatchObject({
      ok: false,
      code: 'invalid_input',
    });
    expect(await service.cancel({ employeeId: STAFF, appointmentId: 1, reason: 'x'.repeat(1001) })).toMatchObject({
      ok: false,
      code: 'invalid_input',
    });
    expect(only().status).toBe('scheduled');

    expect(await service.cancel({ employeeId: STAFF, appointmentId: 1, reason: 'Office closed that week' })).toEqual({ ok: true });
    expect(only()).toMatchObject({ status: 'cancelled', cancelReason: 'Office closed that week' });
    expect(store.state.history.at(-1)).toMatchObject({ eventType: 'cancelled', remarks: 'Office closed that week' });
    expect(store.state.notifications.at(-1)?.message).toContain('Office closed that week');
  });

  test('a cancelled appointment cannot be cancelled or completed again', async () => {
    await service.cancel({ employeeId: STAFF, appointmentId: 1, reason: 'Wrong student' });
    expect(await service.cancel({ employeeId: STAFF, appointmentId: 1, reason: 'Again' })).toMatchObject({ code: 'invalid_status' });
    expect(await service.complete({ employeeId: STAFF, appointmentId: 1 })).toMatchObject({ code: 'invalid_status' });
  });
});

describe('no reminders', () => {
  test('the only student notifications are for staff actions (decision: no reminder job)', async () => {
    await create();
    await service.update({ employeeId: STAFF, appointmentId: 1, today: TODAY, purpose: 'Changed' });
    await service.complete({ employeeId: STAFF, appointmentId: 1 });
    const keys = store.state.notifications.map((n) => n.idempotencyKey);
    expect(keys.some((key) => key.includes('reminder'))).toBe(false);
  });
});
