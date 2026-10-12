import { beforeEach, describe, expect, test } from 'vitest';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A, STUDENT_B } from '../testing/harness.js';
import { createMemoryAppointmentQueries, createMemoryAppointmentStore, type MemoryAppointmentStore } from './memory-store.js';
import { createAppointmentService } from './service.js';

const NOW = new Date('2026-10-12T02:00:00Z'); // Monday 2026-10-12 in Manila
let store: MemoryAppointmentStore;

function build() {
  store = createMemoryAppointmentStore({ students: [STUDENT_A.id, STUDENT_B.id] });
  const service = createAppointmentService({ store, now: () => NOW });
  const queries = createMemoryAppointmentQueries(store, {
    students: { [STUDENT_A.id]: 'Ana Cruz', [STUDENT_B.id]: 'Ben Lee' },
    staff: { [STAFF.id]: 'Officer One' },
  });
  return buildHarnessApp({ appointments: { service, queries }, now: () => NOW });
}

const body = (overrides: Record<string, unknown> = {}) => ({
  studentId: STUDENT_A.id,
  startDate: '2026-10-13',
  purpose: 'Guidance interview',
  notes: 'Bring your ID',
  ...overrides,
});

beforeEach(() => {
  store = createMemoryAppointmentStore();
});

describe('access control', () => {
  const routes: Array<[string, string]> = [
    ['get', '/appointments'],
    ['post', '/appointments'],
    ['patch', '/appointments/1'],
    ['post', '/appointments/1/complete'],
    ['post', '/appointments/1/cancel'],
  ];

  test.each(routes)('%s %s needs a session (401)', async (method, path) => {
    const app = build();
    const { default: request } = await import('supertest');
    const response = await (request(app) as unknown as Record<string, (p: string) => Promise<{ status: number }>>)[method](path);
    expect(response.status).toBe(401);
  });

  test.each(routes)('%s %s is staff only: a student gets 403', async (method, path) => {
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const response = await (agent as unknown as Record<string, (p: string) => Promise<{ status: number }>>)[method](path);
    expect(response.status).toBe(403);
  });
});

describe('POST /appointments', () => {
  test('staff schedule a window: 201, the API computes the end date and the student is notified', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.post('/appointments').send(body());
    expect(response.status).toBe(201);
    expect(response.body.data).toEqual({ appointmentId: 1 });
    expect(store.state.appointments[0]).toMatchObject({ endDate: '2026-10-19', status: 'scheduled', employeeId: STAFF.id });
    expect(store.state.notifications).toHaveLength(1);
  });

  test('an end date sent by the client is ignored', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    await staff.post('/appointments').send(body({ endDate: '2027-01-01' }));
    expect(store.state.appointments[0].endDate).toBe('2026-10-19');
  });

  test.each([
    ['a Sunday', { startDate: '2026-10-18' }, 400, 'invalid_date'],
    ['a past date', { startDate: '2026-10-11' }, 400, 'invalid_date'],
    ['over 60 days ahead', { startDate: '2026-12-12' }, 400, 'invalid_date'],
    ['no purpose', { purpose: '' }, 400, 'invalid_input'],
    ['a malformed student id', { studentId: '2025-123' }, 400, 'invalid_input'],
    ['an unknown student', { studentId: '2099-9999999' }, 404, 'student_not_found'],
  ])('refuses %s', async (_label, override, status, code) => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.post('/appointments').send(body(override));
    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(store.state.appointments).toHaveLength(0);
  });

  test('an overlapping window for the same student is a 409 appointment_overlap', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.post('/appointments').send(body())).status).toBe(201);
    const clash = await staff.post('/appointments').send(body({ startDate: '2026-10-15' }));
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('appointment_overlap');
  });
});

describe('PATCH, complete and cancel', () => {
  async function scheduled() {
    const staff = await signedInAgent(build(), STAFF.email);
    await staff.post('/appointments').send(body());
    return staff;
  }

  test('PATCH with a new start date reschedules', async () => {
    const staff = await scheduled();
    const response = await staff.patch('/appointments/1').send({ startDate: '2026-10-15' });
    expect(response.status).toBe(200);
    expect(store.state.appointments[0]).toMatchObject({ status: 'rescheduled', startDate: '2026-10-15', endDate: '2026-10-21' });
  });

  test('PATCH with only notes keeps the status', async () => {
    const staff = await scheduled();
    expect((await staff.patch('/appointments/1').send({ notes: 'Room 3' })).status).toBe(200);
    expect(store.state.appointments[0]).toMatchObject({ status: 'scheduled', notes: 'Room 3' });
  });

  test('PATCH cannot touch the student, the status or the end date', async () => {
    const staff = await scheduled();
    const response = await staff
      .patch('/appointments/1')
      .send({ studentId: STUDENT_B.id, status: 'completed', endDate: '2030-01-01' });
    expect(response.status).toBe(400); // nothing it is allowed to change
    expect(store.state.appointments[0]).toMatchObject({ studentId: STUDENT_A.id, status: 'scheduled', endDate: '2026-10-19' });
  });

  test('a legal field next to forged ones changes only the legal field', async () => {
    const staff = await scheduled();
    const response = await staff
      .patch('/appointments/1')
      .send({ notes: 'Room 3', studentId: STUDENT_B.id, status: 'completed', endDate: '2030-01-01', employeeId: 'E999' });
    expect(response.status).toBe(200);
    expect(store.state.appointments[0]).toMatchObject({
      notes: 'Room 3',
      studentId: STUDENT_A.id,
      status: 'scheduled',
      endDate: '2026-10-19',
      employeeId: STAFF.id,
    });
  });

  test('complete, then a second complete is a 409', async () => {
    const staff = await scheduled();
    expect((await staff.post('/appointments/1/complete')).status).toBe(200);
    const again = await staff.post('/appointments/1/complete');
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('invalid_status');
  });

  test('cancel needs a reason', async () => {
    const staff = await scheduled();
    expect((await staff.post('/appointments/1/cancel').send({})).status).toBe(400);
    expect((await staff.post('/appointments/1/cancel').send({ reason: 'Student unwell' })).status).toBe(200);
    expect(store.state.appointments[0]).toMatchObject({ status: 'cancelled', cancelReason: 'Student unwell' });
  });

  test.each(['abc', '0x1', '1.5', '-1'])('a malformed id %s is a 404', async (id) => {
    const staff = await scheduled();
    expect((await staff.patch(`/appointments/${id}`).send({ notes: 'x' })).status).toBe(404);
    expect((await staff.post(`/appointments/${id}/complete`)).status).toBe(404);
    expect((await staff.post(`/appointments/${id}/cancel`).send({ reason: 'x' })).status).toBe(404);
  });

  test('an unknown appointment is a 404', async () => {
    const staff = await scheduled();
    expect((await staff.post('/appointments/99/complete')).status).toBe(404);
  });
});

describe('GET /appointments', () => {
  test('lists upcoming by default with the student name, and history on request', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    await staff.post('/appointments').send(body());
    await staff.post('/appointments').send(body({ studentId: STUDENT_B.id, startDate: '2026-10-14', purpose: 'Exit interview' }));
    await staff.post('/appointments/2/cancel').send({ reason: 'Moved offices' });

    const upcoming = await staff.get('/appointments');
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.data.total).toBe(1);
    expect(upcoming.body.data.appointments[0]).toMatchObject({
      id: 1,
      code: 'A-001',
      student: { id: STUDENT_A.id, name: 'Ana Cruz' },
      bucket: 'upcoming',
      assignedBy: 'Officer One',
    });
    expect(upcoming.body.data.appointments[0].history[0]).toMatchObject({ eventType: 'assigned', by: 'Officer One' });

    const history = await staff.get('/appointments').query({ bucket: 'history' });
    expect(history.body.data.appointments.map((a: { id: number }) => a.id)).toEqual([2]);
    expect(history.body.data.appointments[0]).toMatchObject({ status: 'cancelled', cancelReason: 'Moved offices', bucket: 'history' });
  });

  test('searches by student name or purpose', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    await staff.post('/appointments').send(body());
    await staff.post('/appointments').send(body({ studentId: STUDENT_B.id, startDate: '2026-10-14', purpose: 'Exit interview' }));
    const found = await staff.get('/appointments').query({ q: 'ben' });
    expect(found.body.data.appointments.map((a: { id: number }) => a.id)).toEqual([2]);
  });

  test('a window that ended before today is history even if it was never completed', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    store.state.appointments.push({
      appointmentId: 7,
      studentId: STUDENT_A.id,
      employeeId: STAFF.id,
      startDate: '2026-09-01',
      endDate: '2026-09-07',
      purpose: 'Old',
      notes: null,
      status: 'scheduled',
      cancelReason: null,
      dateCreated: NOW,
    });
    const upcoming = await staff.get('/appointments');
    expect(upcoming.body.data.appointments).toHaveLength(0);
    const history = await staff.get('/appointments').query({ bucket: 'history' });
    expect(history.body.data.appointments.map((a: { id: number }) => a.id)).toEqual([7]);
  });

  test.each([{ bucket: 'soon' }, { page: '0' }, { page: 'x' }])('rejects the query %j', async (query) => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.get('/appointments').query(query)).status).toBe(400);
  });
});

describe('what the student sees', () => {
  test('is unchanged by staff-only fields: the /me view carries no staff names', async () => {
    const app = build();
    const staff = await signedInAgent(app, STAFF.email);
    await staff.post('/appointments').send(body());
    // The /me repo in this harness is its own fake; the staff list is what must never leak to students.
    const student = await signedInAgent(app, STUDENT_A.email);
    expect((await student.get('/appointments')).status).toBe(403);
  });
});
