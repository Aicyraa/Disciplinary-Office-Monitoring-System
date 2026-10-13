import { beforeEach, describe, expect, test } from 'vitest';
import { createMemoryCaseStore, type MemoryCaseStore } from '../../src/repositories/cases/memory-store.js';
import type { CaseRecord } from '../../src/types/cases.types.js';
import { DOCX_MIME, PDF_MIME } from '../../src/domain/files/validate.js';
import { createMemoryStorage, type MemoryStorage } from '../../src/integrations/storage/memory.js';
import { createSanctionService, type SanctionService, type UploadedFile } from '../../src/services/sanctions.service.js';

const S1 = '2025-0000001';
const S2 = '2025-0000002';
const STAFF = 'E001';
const NOW = new Date('2026-10-12T02:00:00Z');
const TODAY = '2026-10-12';

const pdf = (name = 'proof.pdf'): UploadedFile => ({
  name,
  mimeType: PDF_MIME,
  bytes: new TextEncoder().encode('%PDF-1.7 fake'),
});
const docx = (name = 'proof.docx'): UploadedFile => ({
  name,
  mimeType: DOCX_MIME,
  bytes: Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x00]),
});

let store: MemoryCaseStore;
let storage: MemoryStorage;
let service: SanctionService;

function seedCase(overrides: Partial<CaseRecord> & { caseId: number }): void {
  store.state.cases.push({
    caseDate: new Date(Date.UTC(2026, 8, overrides.caseId, 2)),
    status: 'validated',
    severity: 'Minor',
    isEscalated: false,
    studentId: S1,
    handbookEntryId: 1,
    originalHandbookEntryId: null,
    source: 'staff',
    reportedByEmployeeId: STAFF,
    claimedStudentId: null,
    claimedName: null,
    submissionRef: null,
    resolvedWithoutSanction: false,
    dateResolved: null,
    ...overrides,
  });
  store.state.nextCaseId = Math.max(store.state.nextCaseId, overrides.caseId + 1);
}

beforeEach(() => {
  store = createMemoryCaseStore({
    students: new Set([S1, S2]),
    handbook: [
      { handbookEntryId: 1, violationType: 'Improper uniform', severity: 'Minor', isSystem: false },
      { handbookEntryId: 68, violationType: '3 minor offense', severity: 'Major', isSystem: true },
    ],
    sanctionCatalog: new Map([
      [1, { sanctionId: 1, sanctionType: 'Violation Slip' }],
      [2, { sanctionId: 2, sanctionType: 'CATEGORY - 1' }],
      [3, { sanctionId: 3, sanctionType: 'CATEGORY - 2' }],
    ]),
    handbookSanctions: new Map([
      [
        1,
        [
          { offenseNumber: 1, sanctionId: 1, sanctionType: 'Violation Slip' },
          { offenseNumber: 1, sanctionId: 2, sanctionType: 'CATEGORY - 1' },
          { offenseNumber: 2, sanctionId: 3, sanctionType: 'CATEGORY - 2' },
        ],
      ],
    ]),
  });
  storage = createMemoryStorage();
  service = createSanctionService({ store, storage, now: () => NOW });
});

const sanction = (id: number) => store.state.caseSanctions.find((s) => s.caseSanctionId === id)!;
const caseRow = (id: number) => store.state.cases.find((c) => c.caseId === id)!;
const sHistory = (id: number) => store.state.sanctionHistory.filter((h) => h.caseSanctionId === id);

async function assigned(): Promise<number> {
  seedCase({ caseId: 1 });
  const result = await service.assignSanction({
    employeeId: STAFF,
    caseId: 1,
    sanctionId: 1,
    dueDate: '2026-10-30',
    staffNote: 'Bring a signed slip',
    today: TODAY,
  });
  if (!result.ok) throw new Error(`setup failed: ${result.code}`);
  return result.caseSanctionId;
}

describe('assignment options (offense number is computed, never typed)', () => {
  test('first offense offers the offense-1 sanctions', async () => {
    seedCase({ caseId: 1 });
    const result = await service.getAssignmentOptions(1);
    expect(result).toMatchObject({ ok: true, options: { offenseNumber: 1, offenseUsed: 1 } });
    if (result.ok) expect(result.options.sanctions.map((s) => s.sanctionId)).toEqual([1, 2]);
  });

  test('a second case for the same violation is the 2nd offense', async () => {
    seedCase({ caseId: 1, status: 'resolved' });
    seedCase({ caseId: 2 });
    const result = await service.getAssignmentOptions(2);
    expect(result).toMatchObject({ ok: true, options: { offenseNumber: 2, offenseUsed: 2 } });
    if (result.ok) expect(result.options.sanctions.map((s) => s.sanctionId)).toEqual([3]);
  });

  test('a 3rd offense falls back to the highest defined offense number', async () => {
    seedCase({ caseId: 1, status: 'resolved' });
    seedCase({ caseId: 2, status: 'resolved' });
    seedCase({ caseId: 3 });
    const result = await service.getAssignmentOptions(3);
    expect(result).toMatchObject({ ok: true, options: { offenseNumber: 3, offenseUsed: 2 } });
  });

  test('an unknown case is not_found', async () => {
    expect(await service.getAssignmentOptions(99)).toMatchObject({ ok: false, code: 'not_found' });
  });
});

describe('assignSanction', () => {
  test('assigns, moves the case to for_sanction, and writes both timelines and a notification', async () => {
    const id = await assigned();
    expect(sanction(id)).toMatchObject({ status: 'assigned', dueDate: '2026-10-30', staffNote: 'Bring a signed slip' });
    expect(caseRow(1).status).toBe('for_sanction');
    expect(store.state.history.at(-1)).toMatchObject({ eventType: 'sanction_assigned', statusAfter: 'for_sanction', employeeId: STAFF });
    expect(sHistory(id)).toEqual([expect.objectContaining({ eventType: 'assigned', employeeId: STAFF, studentId: null })]);
    expect(store.state.sanctionNotifications).toEqual([
      expect.objectContaining({ recipient: 'student', studentId: S1, idempotencyKey: `san:${id}:assigned` }),
    ]);
  });

  test('refuses a sanction the handbook does not allow for this offense', async () => {
    seedCase({ caseId: 1 });
    const result = await service.assignSanction({ employeeId: STAFF, caseId: 1, sanctionId: 3, dueDate: '2026-10-30', staffNote: null, today: TODAY });
    expect(result).toMatchObject({ ok: false, code: 'sanction_not_allowed' });
    expect(store.state.caseSanctions).toHaveLength(0);
    expect(caseRow(1).status).toBe('validated');
  });

  test('a second, different allowed sanction can be added; the same one cannot', async () => {
    await assigned();
    const second = await service.assignSanction({ employeeId: STAFF, caseId: 1, sanctionId: 2, dueDate: '2026-10-30', staffNote: null, today: TODAY });
    expect(second.ok).toBe(true);
    const again = await service.assignSanction({ employeeId: STAFF, caseId: 1, sanctionId: 2, dueDate: '2026-10-30', staffNote: null, today: TODAY });
    expect(again).toMatchObject({ ok: false, code: 'already_assigned' });
    expect(caseRow(1).status).toBe('for_sanction');
  });

  test.each([
    ['2026-10-11', 'due_date_in_past'],
    ['2026-02-30', 'invalid_input'],
    ['tomorrow', 'invalid_input'],
    [20261030, 'invalid_input'],
    [undefined, 'invalid_input'],
  ])('due date %s -> %s', async (dueDate, code) => {
    seedCase({ caseId: 1 });
    const result = await service.assignSanction({ employeeId: STAFF, caseId: 1, sanctionId: 1, dueDate, staffNote: null, today: TODAY });
    expect(result).toMatchObject({ ok: false, code });
  });

  test('today is an acceptable due date (flexible, today or later)', async () => {
    seedCase({ caseId: 1 });
    const result = await service.assignSanction({ employeeId: STAFF, caseId: 1, sanctionId: 1, dueDate: TODAY, staffNote: null, today: TODAY });
    expect(result.ok).toBe(true);
  });

  test.each(['reported', 'rejected', 'resolved'] as const)('is invalid for a %s case', async (status) => {
    seedCase({ caseId: 1, status });
    const result = await service.assignSanction({ employeeId: STAFF, caseId: 1, sanctionId: 1, dueDate: '2026-10-30', staffNote: null, today: TODAY });
    expect(result).toMatchObject({ ok: false, code: 'invalid_status' });
  });

  test('rejects over-long instructions', async () => {
    seedCase({ caseId: 1 });
    const result = await service.assignSanction({ employeeId: STAFF, caseId: 1, sanctionId: 1, dueDate: '2026-10-30', staffNote: 'x'.repeat(1001), today: TODAY });
    expect(result).toMatchObject({ ok: false, code: 'invalid_input' });
  });
});

describe('uploadProof', () => {
  test('first upload moves the sanction to pending_verification and notifies staff', async () => {
    const id = await assigned();
    const result = await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    expect(result).toMatchObject({ ok: true });
    expect(sanction(id)).toMatchObject({ status: 'pending_verification', dateSubmitted: NOW });
    expect(sanction(id).files).toHaveLength(1);
    expect(sanction(id).files[0]).toMatchObject({ originalName: 'proof.pdf', mimeType: PDF_MIME, uploadedByStudentId: S1 });
    expect([...storage.objects.keys()]).toEqual([sanction(id).files[0].storageKey]);
    expect(sanction(id).files[0].storageKey).toMatch(new RegExp(`^proof/${id}/[0-9a-f-]+\\.pdf$`));
    expect(sHistory(id).map((h) => h.eventType)).toEqual(['assigned', 'proof_uploaded']);
    expect(sHistory(id)[1]).toMatchObject({ studentId: S1, employeeId: null });
    expect(store.state.sanctionNotifications.at(-1)).toMatchObject({ recipient: 'staff', studentId: null });
  });

  test('accepts up to five files in one submission', async () => {
    const id = await assigned();
    const result = await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('a.pdf'), pdf('b.pdf'), docx('c.docx'), pdf('d.pdf'), pdf('e.pdf')] });
    expect(result).toMatchObject({ ok: true });
    expect(sanction(id).files).toHaveLength(5);
    expect(storage.objects.size).toBe(5);
  });

  test('refuses a sixth file and stores nothing', async () => {
    const id = await assigned();
    const files = Array.from({ length: 6 }, (_, i) => pdf(`f${i}.pdf`));
    expect(await service.uploadProof({ studentId: S1, caseSanctionId: id, files })).toMatchObject({ ok: false, code: 'too_many_files' });
    expect(storage.objects.size).toBe(0);
    expect(sanction(id).status).toBe('assigned');
  });

  test.each([
    ['an image', { name: 'a.png', mimeType: 'image/png', bytes: new TextEncoder().encode('%PDF') }, 'unsupported_type'],
    ['a renamed file', { name: 'a.pdf', mimeType: PDF_MIME, bytes: Uint8Array.from([1, 2, 3, 4]) }, 'content_mismatch'],
    ['an empty file', { name: 'a.pdf', mimeType: PDF_MIME, bytes: new Uint8Array() }, 'empty'],
  ])('rejects %s and leaves nothing behind', async (_label, file, code) => {
    const id = await assigned();
    const result = await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('ok.pdf'), file] });
    expect(result).toMatchObject({ ok: false, code });
    expect(storage.objects.size).toBe(0);
    expect(sanction(id)).toMatchObject({ status: 'assigned', files: [] });
  });

  test("another student's sanction is not_found", async () => {
    const id = await assigned();
    expect(await service.uploadProof({ studentId: S2, caseSanctionId: id, files: [pdf()] })).toMatchObject({
      ok: false,
      code: 'not_found',
    });
    expect(storage.objects.size).toBe(0);
  });

  test('cannot add files while pending_verification, and not after completion', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    expect(await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('b.pdf')] })).toMatchObject({
      ok: false,
      code: 'upload_not_allowed',
    });
    sanction(id).status = 'completed';
    expect(await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('c.pdf')] })).toMatchObject({
      ok: false,
      code: 'invalid_status',
    });
  });

  test('replace swaps the file, deletes the old object, and logs proof_replaced', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('old.pdf')] });
    const oldFile = sanction(id).files[0];
    const result = await service.uploadProof({
      studentId: S1,
      caseSanctionId: id,
      files: [docx('new.docx')],
      replaceCaseSanctionFileId: oldFile.caseSanctionFileId,
    });
    expect(result).toMatchObject({ ok: true });
    expect(sanction(id).files.map((f) => f.originalName)).toEqual(['new.docx']);
    expect(storage.objects.has(oldFile.storageKey)).toBe(false);
    expect(storage.objects.size).toBe(1);
    expect(sHistory(id).at(-1)).toMatchObject({ eventType: 'proof_replaced', remarks: 'new.docx' });
    expect(sanction(id).status).toBe('pending_verification');
  });

  test('replace is refused with already_reviewed once staff opened a file, and stores nothing new', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('old.pdf')] });
    const oldFile = sanction(id).files[0];
    await service.fileDownloadUrl({ requester: { role: 'staff', id: STAFF }, caseSanctionFileId: oldFile.caseSanctionFileId });
    const before = storage.objects.size;
    const result = await service.uploadProof({
      studentId: S1,
      caseSanctionId: id,
      files: [pdf('new.pdf')],
      replaceCaseSanctionFileId: oldFile.caseSanctionFileId,
    });
    expect(result).toMatchObject({ ok: false, code: 'already_reviewed' });
    expect(storage.objects.size).toBe(before);
    expect(sanction(id).files[0].originalName).toBe('old.pdf');
  });

  test('replace needs exactly one file and an existing file id', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    expect(
      await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('a.pdf'), pdf('b.pdf')], replaceCaseSanctionFileId: 1 }),
    ).toMatchObject({ ok: false, code: 'invalid_input' });
    expect(
      await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('a.pdf')], replaceCaseSanctionFileId: 999 }),
    ).toMatchObject({ ok: false, code: 'not_found' });
  });

  test('a database failure after the object was stored removes the object (no orphans)', async () => {
    const id = await assigned();
    store.failAfterWrites(0);
    await expect(service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] })).rejects.toThrow(/simulated failure/);
    store.failAfterWrites(null);
    expect(storage.objects.size).toBe(0);
    expect(sanction(id)).toMatchObject({ status: 'assigned', files: [] });
  });
});

describe('upload regressions from the step 5 review', () => {
  /** A service whose storage misbehaves in one way; it shares the same in-memory objects. */
  const withStorage = (overrides: Partial<MemoryStorage>) =>
    createSanctionService({ store, storage: { ...storage, ...overrides } as MemoryStorage, now: () => NOW });

  test('replacing a file while returned resubmits the sanction and notifies staff', async () => {
    // An advancing clock: the notification key carries the timestamp, so two submissions in one instant would
    // (correctly) collapse into one.
    let tick = NOW.getTime();
    const clocked = createSanctionService({ store, storage, now: () => new Date((tick += 60_000)) });
    const id = await assigned();
    await clocked.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('v1.pdf')] });
    await clocked.returnForRevision({ employeeId: STAFF, caseSanctionId: id, reason: 'Unsigned' });
    expect(sanction(id).status).toBe('returned');
    const before = store.state.sanctionNotifications.filter((n) => n.recipient === 'staff').length;

    const result = await clocked.uploadProof({
      studentId: S1,
      caseSanctionId: id,
      files: [pdf('v2.pdf')],
      replaceCaseSanctionFileId: sanction(id).files[0].caseSanctionFileId,
    });
    expect(result).toMatchObject({ ok: true });
    expect(sanction(id)).toMatchObject({ status: 'pending_verification' });
    expect(sanction(id).files.map((f) => f.originalName)).toEqual(['v2.pdf']);
    expect(store.state.sanctionNotifications.filter((n) => n.recipient === 'staff')).toHaveLength(before + 1);
  });

  test('a failed delete of the replaced object after commit does not undo or fail the replacement', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('old.pdf')] });
    const oldKey = sanction(id).files[0].storageKey;
    const flaky = withStorage({
      delete: async (key: string) => {
        if (key === oldKey) throw new Error('bucket unavailable');
        storage.objects.delete(key);
      },
    });

    const result = await flaky.uploadProof({
      studentId: S1,
      caseSanctionId: id,
      files: [docx('new.docx')],
      replaceCaseSanctionFileId: sanction(id).files[0].caseSanctionFileId,
    });
    expect(result).toMatchObject({ ok: true });
    const newKey = sanction(id).files[0].storageKey;
    expect(newKey).not.toBe(oldKey);
    // The row still points at an object that exists; only the old object is left behind.
    expect(storage.objects.has(newKey)).toBe(true);
  });

  test('a failed delete after a removal still reports success', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('a.pdf'), pdf('b.pdf')] });
    const flaky = withStorage({
      delete: async () => {
        throw new Error('bucket unavailable');
      },
    });
    const result = await flaky.removeProof({ studentId: S1, caseSanctionFileId: sanction(id).files[1].caseSanctionFileId });
    expect(result).toEqual({ ok: true });
    expect(sanction(id).files).toHaveLength(1);
  });

  test('a put that fails halfway removes the objects already stored and inserts nothing', async () => {
    const id = await assigned();
    let puts = 0;
    const flaky = withStorage({
      put: async (key: string, body: Uint8Array, type: string) => {
        puts += 1;
        if (puts === 2) throw new Error('bucket unavailable');
        storage.objects.set(key, { body, contentType: type });
      },
    });
    await expect(flaky.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('a.pdf'), pdf('b.pdf')] })).rejects.toThrow(
      /bucket unavailable/,
    );
    expect(storage.objects.size).toBe(0);
    expect(sanction(id)).toMatchObject({ status: 'assigned', files: [] });
  });

  test('the bytes go to the bucket before the transaction that writes the rows (no row lock held during the upload)', async () => {
    const id = await assigned();
    store.calls.length = 0;
    const order: string[] = [];
    const watching = withStorage({
      put: async (key: string, body: Uint8Array, type: string) => {
        order.push(`put after ${store.calls.length} store calls`);
        storage.objects.set(key, { body, contentType: type });
      },
    });
    await watching.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    const lockAt = store.calls.indexOf('lockStudent');
    expect(order).toHaveLength(1);
    // The only store call before the put is the early, lock-free read.
    expect(store.calls.slice(0, lockAt)).not.toContain('updateCaseSanction');
    expect(Number(order[0].match(/\d+/)?.[0])).toBeLessThanOrEqual(lockAt);
  });

  test('if the sanction changed while the bytes were uploading, the objects are removed and nothing is written', async () => {
    const id = await assigned();
    // The first lock is taken by the write phase; flip the status as if staff completed it meanwhile.
    store.onFirstLock((working) => {
      const target = working.caseSanctions.find((s) => s.caseSanctionId === id);
      if (target) target.status = 'completed';
    });
    const result = await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    expect(result).toMatchObject({ ok: false, code: 'invalid_status' });
    expect(storage.objects.size).toBe(0);
  });

  test('a file is not marked viewed when the link could not be issued', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    const fileId = sanction(id).files[0].caseSanctionFileId;
    const broken = withStorage({
      presignGet: async () => {
        throw new Error('bucket unavailable');
      },
    });
    await expect(broken.fileDownloadUrl({ requester: { role: 'staff', id: STAFF }, caseSanctionFileId: fileId })).rejects.toThrow();
    expect(sanction(id).files[0].dateViewed).toBeNull();
  });
});

describe('removeProof', () => {
  async function submitted(count: number) {
    const id = await assigned();
    const files = Array.from({ length: count }, (_, i) => pdf(`p${i}.pdf`));
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files });
    return id;
  }

  test('cannot remove the last file while pending_verification', async () => {
    const id = await submitted(1);
    const result = await service.removeProof({ studentId: S1, caseSanctionFileId: sanction(id).files[0].caseSanctionFileId });
    expect(result).toMatchObject({ ok: false, code: 'last_file' });
    expect(sanction(id).files).toHaveLength(1);
  });

  test('removes one of several, deletes the object and logs proof_removed', async () => {
    const id = await submitted(2);
    const target = sanction(id).files[1];
    expect(await service.removeProof({ studentId: S1, caseSanctionFileId: target.caseSanctionFileId })).toEqual({ ok: true });
    expect(sanction(id).files).toHaveLength(1);
    expect(storage.objects.has(target.storageKey)).toBe(false);
    expect(sHistory(id).at(-1)).toMatchObject({ eventType: 'proof_removed', remarks: 'p1.pdf' });
  });

  test('is refused with already_reviewed once staff opened any file', async () => {
    const id = await submitted(2);
    await service.fileDownloadUrl({ requester: { role: 'staff', id: STAFF }, caseSanctionFileId: sanction(id).files[0].caseSanctionFileId });
    const result = await service.removeProof({ studentId: S1, caseSanctionFileId: sanction(id).files[1].caseSanctionFileId });
    expect(result).toMatchObject({ ok: false, code: 'already_reviewed' });
  });

  test("another student's file is not_found", async () => {
    const id = await submitted(2);
    expect(await service.removeProof({ studentId: S2, caseSanctionFileId: sanction(id).files[0].caseSanctionFileId })).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });

  test('after a return, any file may be removed (even the last)', async () => {
    const id = await submitted(1);
    await service.fileDownloadUrl({ requester: { role: 'staff', id: STAFF }, caseSanctionFileId: sanction(id).files[0].caseSanctionFileId });
    await service.returnForRevision({ employeeId: STAFF, caseSanctionId: id, reason: 'Unreadable' });
    const result = await service.removeProof({ studentId: S1, caseSanctionFileId: sanction(id).files[0].caseSanctionFileId });
    expect(result).toEqual({ ok: true });
    expect(sanction(id).files).toHaveLength(0);
  });
});

describe('fileDownloadUrl', () => {
  test('gives the owner a 60-second link without marking it viewed', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    const file = sanction(id).files[0];
    const result = await service.fileDownloadUrl({ requester: { role: 'student', id: S1 }, caseSanctionFileId: file.caseSanctionFileId });
    expect(result).toMatchObject({ ok: true, expiresInSeconds: 60 });
    if (result.ok) expect(result.url).toContain(file.storageKey);
    expect(sanction(id).files[0].dateViewed).toBeNull();
  });

  test('staff opening a file sets date_viewed and viewed_by once', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    const fileId = sanction(id).files[0].caseSanctionFileId;
    await service.fileDownloadUrl({ requester: { role: 'staff', id: STAFF }, caseSanctionFileId: fileId });
    expect(sanction(id).files[0]).toMatchObject({ dateViewed: NOW, viewedByEmployeeId: STAFF });
  });

  test("another student cannot open someone else's file", async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    const result = await service.fileDownloadUrl({
      requester: { role: 'student', id: S2 },
      caseSanctionFileId: sanction(id).files[0].caseSanctionFileId,
    });
    expect(result).toMatchObject({ ok: false, code: 'not_found' });
  });

  test('an unknown file is not_found', async () => {
    expect(await service.fileDownloadUrl({ requester: { role: 'staff', id: STAFF }, caseSanctionFileId: 404 })).toMatchObject({
      ok: false,
      code: 'not_found',
    });
  });
});

describe('verify', () => {
  test('is blocked until every file has been opened, then completes the sanction', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('a.pdf'), pdf('b.pdf')] });
    const [first, second] = sanction(id).files;

    const blocked = await service.verify({ employeeId: STAFF, caseSanctionId: id });
    expect(blocked).toMatchObject({ ok: false, code: 'files_not_viewed' });
    if (!blocked.ok) expect(blocked.message).toContain('0 of 2');

    await service.fileDownloadUrl({ requester: { role: 'staff', id: STAFF }, caseSanctionFileId: first.caseSanctionFileId });
    const half = await service.verify({ employeeId: STAFF, caseSanctionId: id });
    if (!half.ok) expect(half.message).toContain('1 of 2');
    expect(half.ok).toBe(false);

    await service.fileDownloadUrl({ requester: { role: 'staff', id: STAFF }, caseSanctionFileId: second.caseSanctionFileId });
    expect(await service.verify({ employeeId: STAFF, caseSanctionId: id })).toEqual({ ok: true });
    expect(sanction(id)).toMatchObject({ status: 'completed', dateCompleted: NOW });
    expect(sHistory(id).at(-1)).toMatchObject({ eventType: 'verified', employeeId: STAFF });
    expect(store.state.sanctionNotifications.at(-1)).toMatchObject({ recipient: 'student', idempotencyKey: `san:${id}:completed` });
  });

  test('a sanction with no uploaded file can never be verified (online proof only)', async () => {
    const id = await assigned();
    sanction(id).status = 'pending_verification'; // e.g. a row left over from the removed in-person path
    const result = await service.verify({ employeeId: STAFF, caseSanctionId: id });
    expect(result).toMatchObject({ ok: false, code: 'files_not_viewed' });
    if (!result.ok) expect(result.message).toMatch(/no proof file/i);
    expect(sanction(id).status).toBe('pending_verification');
  });

  test('a sanction cannot be completed before the student has uploaded a file', async () => {
    const id = await assigned();
    expect(await service.verify({ employeeId: STAFF, caseSanctionId: id })).toMatchObject({ ok: false, code: 'invalid_status' });
    expect(sanction(id).status).toBe('assigned');
  });

  test.each(['assigned', 'returned', 'completed'] as const)('is invalid from %s', async (status) => {
    const id = await assigned();
    sanction(id).status = status;
    expect(await service.verify({ employeeId: STAFF, caseSanctionId: id })).toMatchObject({ ok: false, code: 'invalid_status' });
  });

  test('a verify that waited for a return to commit sees it and refuses', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    store.onFirstLock((working) => {
      const target = working.caseSanctions.find((s) => s.caseSanctionId === id);
      if (target) target.status = 'returned';
    });
    expect(await service.verify({ employeeId: STAFF, caseSanctionId: id })).toMatchObject({ ok: false, code: 'invalid_status' });
  });
});

describe('returnForRevision and re-upload', () => {
  test('needs a reason, then returns the sanction with the reason as the staff note', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf()] });
    expect(await service.returnForRevision({ employeeId: STAFF, caseSanctionId: id, reason: '  ' })).toMatchObject({
      ok: false,
      code: 'invalid_input',
    });
    expect(await service.returnForRevision({ employeeId: STAFF, caseSanctionId: id, reason: 'Missing signature' })).toEqual({ ok: true });
    expect(sanction(id)).toMatchObject({ status: 'returned', staffNote: 'Missing signature' });
    expect(sHistory(id).at(-1)).toMatchObject({ eventType: 'returned', remarks: 'Missing signature' });
  });

  test('the student re-uploads, it goes back to pending, and verify needs the new file opened', async () => {
    const id = await assigned();
    await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('v1.pdf')] });
    await service.fileDownloadUrl({ requester: { role: 'staff', id: STAFF }, caseSanctionFileId: sanction(id).files[0].caseSanctionFileId });
    await service.returnForRevision({ employeeId: STAFF, caseSanctionId: id, reason: 'Sign it' });

    expect(await service.uploadProof({ studentId: S1, caseSanctionId: id, files: [pdf('v2.pdf')] })).toMatchObject({ ok: true });
    expect(sanction(id).status).toBe('pending_verification');
    expect(sanction(id).files).toHaveLength(2);

    expect(await service.verify({ employeeId: STAFF, caseSanctionId: id })).toMatchObject({ ok: false, code: 'files_not_viewed' });
    const newest = sanction(id).files.find((f) => f.originalName === 'v2.pdf')!;
    await service.fileDownloadUrl({ requester: { role: 'staff', id: STAFF }, caseSanctionFileId: newest.caseSanctionFileId });
    expect(await service.verify({ employeeId: STAFF, caseSanctionId: id })).toEqual({ ok: true });
  });

  test('cannot return a sanction that is not waiting for verification', async () => {
    const id = await assigned();
    expect(await service.returnForRevision({ employeeId: STAFF, caseSanctionId: id, reason: 'x' })).toMatchObject({
      ok: false,
      code: 'invalid_status',
    });
  });
});

describe('online proof only', () => {
  test('the service has no way to record compliance without a file', () => {
    expect('recordCompliance' in service).toBe(false);
  });
});
