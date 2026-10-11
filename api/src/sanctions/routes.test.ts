import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMemoryCaseStore, type MemoryCaseStore } from '../cases/memory-store.js';
import type { CaseRecord } from '../cases/types.js';
import { DOCX_MIME, MAX_FILE_BYTES, PDF_MIME } from '../files/validate.js';
import { createMemoryStorage, type MemoryStorage } from '../storage/memory.js';
import { buildHarnessApp, signedInAgent, STAFF, STAFF_TEMP, STUDENT_A, STUDENT_B } from '../testing/harness.js';
import { createSanctionService, type SanctionService } from './service.js';

const S1 = STUDENT_A.id;
const NOW = new Date('2026-10-12T02:00:00Z'); // Manila 2026-10-12

const pdfBytes = Buffer.from('%PDF-1.7 fake');
const docxBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);

let store: MemoryCaseStore;
let storage: MemoryStorage;
let service: SanctionService;

function seedCase(caseId: number, overrides: Partial<CaseRecord> = {}): void {
  store.state.cases.push({
    caseId,
    caseDate: new Date(Date.UTC(2026, 8, caseId, 2)),
    status: 'validated',
    severity: 'Minor',
    isEscalated: false,
    studentId: S1,
    handbookEntryId: 1,
    originalHandbookEntryId: null,
    source: 'staff',
    reportedByEmployeeId: STAFF.id,
    claimedStudentId: null,
    claimedName: null,
    submissionRef: null,
    resolvedWithoutSanction: false,
    dateResolved: null,
    ...overrides,
  });
}

function build() {
  return buildHarnessApp({ sanctions: { service }, now: () => NOW });
}

beforeEach(() => {
  store = createMemoryCaseStore({
    students: new Set([S1, STUDENT_B.id]),
    handbook: [
      { handbookEntryId: 1, violationType: 'Improper uniform', severity: 'Minor', isSystem: false },
      { handbookEntryId: 68, violationType: '3 minor offense', severity: 'Major', isSystem: true },
    ],
    sanctionCatalog: new Map([
      [1, { sanctionId: 1, sanctionType: 'Violation Slip' }],
      [2, { sanctionId: 2, sanctionType: 'CATEGORY - 1' }],
    ]),
    handbookSanctions: new Map([
      [
        1,
        [
          { offenseNumber: 1, sanctionId: 1, sanctionType: 'Violation Slip' },
          { offenseNumber: 1, sanctionId: 2, sanctionType: 'CATEGORY - 1' },
        ],
      ],
    ]),
  });
  storage = createMemoryStorage();
  service = createSanctionService({ store, storage, now: () => NOW });
});

async function assign(caseId = 1): Promise<number> {
  seedCase(caseId);
  const result = await service.assignSanction({
    employeeId: STAFF.id,
    caseId,
    sanctionId: 1,
    dueDate: '2026-10-30',
    staffNote: null,
    today: '2026-10-12',
  });
  if (!result.ok) throw new Error(result.code);
  return result.caseSanctionId;
}

describe('access control', () => {
  const staffRoutes: Array<[string, string]> = [
    ['get', '/cases/1/sanction-options'],
    ['post', '/cases/1/sanctions'],
    ['post', '/case-sanctions/1/record-compliance'],
    ['post', '/case-sanctions/1/verify'],
    ['post', '/case-sanctions/1/return'],
  ];
  const studentRoutes: Array<[string, string]> = [
    ['post', '/files'],
    ['delete', '/files/1'],
  ];

  test.each([...staffRoutes, ...studentRoutes, ['get', '/files/1/url']])('%s %s is 401 without a session', async (method, path) => {
    const response = await (request(build()) as unknown as Record<string, (p: string) => request.Test>)[method](path);
    expect(response.status).toBe(401);
  });

  test.each(staffRoutes)('%s %s is 403 for a student', async (method, path) => {
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const response = await (agent as unknown as Record<string, (p: string) => request.Test>)[method](path);
    expect(response.status).toBe(403);
  });

  test.each(studentRoutes)('%s %s is 403 for staff', async (method, path) => {
    const agent = await signedInAgent(build(), STAFF.email);
    const response = await (agent as unknown as Record<string, (p: string) => request.Test>)[method](path);
    expect(response.status).toBe(403);
  });

  test('a staff account that must change its password is blocked from every sanction route', async () => {
    const agent = await signedInAgent(build(), STAFF_TEMP.email);
    for (const [method, path] of [...staffRoutes, ['get', '/files/1/url']]) {
      const response = await (agent as unknown as Record<string, (p: string) => request.Test>)[method](path);
      expect(response.status).toBe(403);
      expect(response.body.error).toBe('password_change_required');
    }
  });
});

describe('staff: assign', () => {
  test('options show the computed offense number and the allowed sanctions', async () => {
    seedCase(1);
    const agent = await signedInAgent(build(), STAFF.email);
    const response = await agent.get('/cases/1/sanction-options');
    expect(response.status).toBe(200);
    expect(response.body.options).toMatchObject({ offenseNumber: 1, offenseUsed: 1 });
    expect(response.body.options.sanctions.map((s: { sanctionCode: string }) => s.sanctionCode)).toEqual(['S001', 'S002']);
  });

  test('assigns with a due date and the case becomes for_sanction', async () => {
    seedCase(1);
    const agent = await signedInAgent(build(), STAFF.email);
    const response = await agent.post('/cases/1/sanctions').send({ sanctionId: 1, dueDate: '2026-10-30', staffNote: 'Bring a slip' });
    expect(response.status).toBe(201);
    expect(store.state.cases[0].status).toBe('for_sanction');
    expect(store.state.caseSanctions[0]).toMatchObject({ dueDate: '2026-10-30', staffNote: 'Bring a slip' });
  });

  test.each([
    [{ sanctionId: 1, dueDate: '2026-10-11' }, 400, 'due_date_in_past'],
    [{ sanctionId: 1, dueDate: 'soon' }, 400, 'invalid_input'],
    [{ dueDate: '2026-10-30' }, 400, 'invalid_input'],
    [{ sanctionId: '1', dueDate: '2026-10-30' }, 400, 'invalid_input'],
    [{ sanctionId: 99, dueDate: '2026-10-30' }, 409, 'sanction_not_allowed'],
  ])('rejects %j with %i %s', async (body, status, code) => {
    seedCase(1);
    const agent = await signedInAgent(build(), STAFF.email);
    const response = await agent.post('/cases/1/sanctions').send(body);
    expect(response.status).toBe(status);
    expect(response.body.error).toBe(code);
    expect(store.state.caseSanctions).toHaveLength(0);
  });

  test('an unknown case is 404 and a duplicate is 409', async () => {
    const agent = await signedInAgent(build(), STAFF.email);
    expect((await agent.post('/cases/77/sanctions').send({ sanctionId: 1, dueDate: '2026-10-30' })).status).toBe(404);
    seedCase(1);
    await agent.post('/cases/1/sanctions').send({ sanctionId: 1, dueDate: '2026-10-30' });
    const again = await agent.post('/cases/1/sanctions').send({ sanctionId: 1, dueDate: '2026-10-30' });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('already_assigned');
  });
});

describe('student: proof upload', () => {
  test('uploads several files in one request and the sanction becomes pending_verification', async () => {
    const id = await assign();
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const response = await agent
      .post('/files')
      .field('caseSanctionId', String(id))
      .attach('files', pdfBytes, { filename: 'a.pdf', contentType: PDF_MIME })
      .attach('files', docxBytes, { filename: 'b.docx', contentType: DOCX_MIME });
    expect(response.status).toBe(201);
    expect(response.body.fileIds).toHaveLength(2);
    expect(store.state.caseSanctions[0].status).toBe('pending_verification');
    expect(storage.objects.size).toBe(2);
  });

  test('a sixth file is refused and nothing is stored', async () => {
    const id = await assign();
    const agent = await signedInAgent(build(), STUDENT_A.email);
    let pending = agent.post('/files').field('caseSanctionId', String(id));
    for (let i = 0; i < 6; i += 1) pending = pending.attach('files', pdfBytes, { filename: `f${i}.pdf`, contentType: PDF_MIME });
    const response = await pending;
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('too_many_files');
    expect(storage.objects.size).toBe(0);
  });

  test('a file over 10 MB is 413 and nothing is stored', async () => {
    const id = await assign();
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const big = Buffer.concat([pdfBytes, Buffer.alloc(MAX_FILE_BYTES)]);
    const response = await agent
      .post('/files')
      .field('caseSanctionId', String(id))
      .attach('files', big, { filename: 'big.pdf', contentType: PDF_MIME });
    expect(response.status).toBe(413);
    expect(response.body.error).toBe('too_large');
    expect(storage.objects.size).toBe(0);
  });

  test.each([
    ['an image', Buffer.from('%PDF-1.7'), 'a.png', 'image/png', 'unsupported_type'],
    ['a renamed file', Buffer.from('not a pdf at all'), 'a.pdf', PDF_MIME, 'content_mismatch'],
  ])('rejects %s with 400', async (_label, bytes, filename, contentType, code) => {
    const id = await assign();
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const response = await agent.post('/files').field('caseSanctionId', String(id)).attach('files', bytes, { filename, contentType });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe(code);
    expect(storage.objects.size).toBe(0);
  });

  test('needs a caseSanctionId and at least one file', async () => {
    const id = await assign();
    const agent = await signedInAgent(build(), STUDENT_A.email);
    expect((await agent.post('/files').attach('files', pdfBytes, { filename: 'a.pdf', contentType: PDF_MIME })).status).toBe(400);
    const none = await agent.post('/files').field('caseSanctionId', String(id));
    expect(none.status).toBe(400);
    expect(none.body.error).toBe('invalid_input');
  });

  test("another student cannot upload to your sanction (404)", async () => {
    const id = await assign();
    const other = await signedInAgent(build(), STUDENT_B.email);
    const response = await other
      .post('/files')
      .field('caseSanctionId', String(id))
      .attach('files', pdfBytes, { filename: 'a.pdf', contentType: PDF_MIME });
    expect(response.status).toBe(404);
    expect(storage.objects.size).toBe(0);
  });

  test('replace and delete follow the rules: not the last file, 204 on success', async () => {
    const id = await assign();
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const first = await agent
      .post('/files')
      .field('caseSanctionId', String(id))
      .attach('files', pdfBytes, { filename: 'a.pdf', contentType: PDF_MIME })
      .attach('files', pdfBytes, { filename: 'b.pdf', contentType: PDF_MIME });
    const [fileA, fileB] = first.body.fileIds as number[];

    const replaced = await agent
      .post('/files')
      .field('caseSanctionId', String(id))
      .field('replaceFileId', String(fileA))
      .attach('files', pdfBytes, { filename: 'a2.pdf', contentType: PDF_MIME });
    expect(replaced.status).toBe(201);

    expect((await agent.delete(`/files/${fileB}`)).status).toBe(204);
    const lastId = store.state.caseSanctions[0].files[0].caseSanctionFileId;
    const last = await agent.delete(`/files/${lastId}`);
    expect(last.status).toBe(409);
    expect(last.body.error).toBe('last_file');
  });
});

describe('download link and staff review', () => {
  async function submitted() {
    const id = await assign();
    const student = await signedInAgent(build(), STUDENT_A.email);
    await student
      .post('/files')
      .field('caseSanctionId', String(id))
      .attach('files', pdfBytes, { filename: 'a.pdf', contentType: PDF_MIME });
    return { id, student, fileId: store.state.caseSanctions[0].files[0].caseSanctionFileId };
  }

  test('the owner and staff get a short-lived link; others get 404', async () => {
    const { fileId, student } = await submitted();
    const own = await student.get(`/files/${fileId}/url`);
    expect(own.status).toBe(200);
    expect(own.body.expiresInSeconds).toBe(60);
    expect(own.headers['cache-control']).toBe('no-store');

    const other = await signedInAgent(build(), STUDENT_B.email);
    expect((await other.get(`/files/${fileId}/url`)).status).toBe(404);
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.get(`/files/${fileId}/url`)).status).toBe(200);
  });

  test('verify is 409 until staff open the file, then 200 and the sanction is completed', async () => {
    const { id, fileId } = await submitted();
    const staff = await signedInAgent(build(), STAFF.email);
    const blocked = await staff.post(`/case-sanctions/${id}/verify`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe('files_not_viewed');
    expect(blocked.body.message).toContain('0 of 1');

    await staff.get(`/files/${fileId}/url`);
    expect((await staff.post(`/case-sanctions/${id}/verify`)).status).toBe(200);
    expect(store.state.caseSanctions[0]).toMatchObject({ status: 'completed', dateCompleted: NOW });
  });

  test("a student's own opening of a file does not count as staff review", async () => {
    const { id, fileId, student } = await submitted();
    await student.get(`/files/${fileId}/url`);
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.post(`/case-sanctions/${id}/verify`)).status).toBe(409);
  });

  test('return needs a reason; after it the student can upload again', async () => {
    const { id, fileId, student } = await submitted();
    const staff = await signedInAgent(build(), STAFF.email);
    await staff.get(`/files/${fileId}/url`);
    expect((await staff.post(`/case-sanctions/${id}/return`).send({})).status).toBe(400);
    expect((await staff.post(`/case-sanctions/${id}/return`).send({ reason: 'Unsigned' })).status).toBe(200);
    expect(store.state.caseSanctions[0].status).toBe('returned');

    const again = await student
      .post('/files')
      .field('caseSanctionId', String(id))
      .attach('files', docxBytes, { filename: 'signed.docx', contentType: DOCX_MIME });
    expect(again.status).toBe(201);
    expect(store.state.caseSanctions[0].status).toBe('pending_verification');
  });

  test('proof rules at the HTTP boundary: 409 upload_not_allowed, then 409 already_reviewed after staff opened a file', async () => {
    const { id, fileId, student } = await submitted();
    const extra = await student
      .post('/files')
      .field('caseSanctionId', String(id))
      .attach('files', pdfBytes, { filename: 'b.pdf', contentType: PDF_MIME });
    expect(extra.status).toBe(409);
    expect(extra.body.error).toBe('upload_not_allowed');

    const staff = await signedInAgent(build(), STAFF.email);
    await staff.get(`/files/${fileId}/url`);
    const replace = await student
      .post('/files')
      .field('caseSanctionId', String(id))
      .field('replaceFileId', String(fileId))
      .attach('files', pdfBytes, { filename: 'c.pdf', contentType: PDF_MIME });
    expect(replace.status).toBe(409);
    expect(replace.body.error).toBe('already_reviewed');
    const remove = await student.delete(`/files/${fileId}`);
    expect(remove.status).toBe(409);
  });

  test('after a return, replacing a file resubmits it', async () => {
    const { id, fileId, student } = await submitted();
    const staff = await signedInAgent(build(), STAFF.email);
    await staff.get(`/files/${fileId}/url`);
    await staff.post(`/case-sanctions/${id}/return`).send({ reason: 'Unsigned' });
    const replaced = await student
      .post('/files')
      .field('caseSanctionId', String(id))
      .field('replaceFileId', String(fileId))
      .attach('files', pdfBytes, { filename: 'signed.pdf', contentType: PDF_MIME });
    expect(replaced.status).toBe(201);
    expect(store.state.caseSanctions[0].status).toBe('pending_verification');
  });

  test('a malformed multipart body is a 400, never a 500', async () => {
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const response = await agent
      .post('/files')
      .set('Content-Type', 'multipart/form-data; boundary=----broken')
      .send('------broken\r\nContent-Disposition: form-data; name="files"; filename=\r\n');
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_input');
  });

  test('record-compliance needs a note and moves an assigned sanction to pending', async () => {
    const id = await assign();
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.post(`/case-sanctions/${id}/record-compliance`).send({})).status).toBe(400);
    expect((await staff.post(`/case-sanctions/${id}/record-compliance`).send({ note: 'Served on site' })).status).toBe(200);
    expect(store.state.caseSanctions[0].status).toBe('pending_verification');
  });

  test.each(['abc', '0x1', '1.5', '-1'])('a malformed id %s is 404', async (id) => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.post(`/case-sanctions/${id}/verify`)).status).toBe(404);
    expect((await staff.get(`/files/${id}/url`)).status).toBe(404);
  });
});
