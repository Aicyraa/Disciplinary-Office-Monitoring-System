import { beforeEach, describe, expect, test } from 'vitest';
import { DOCX_MIME, MAX_FILE_BYTES, PDF_MIME } from '../../src/domain/files/validate.js';
import { createMemoryStorage, type MemoryStorage } from '../../src/integrations/storage/memory.js';
import { createMemoryTemplateStore, type MemoryTemplateStore } from '../../src/repositories/templates/memory-store.js';
import { createTemplateService, type TemplateService } from '../../src/services/templates.service.js';

const STAFF = 'E001';
const NOW = new Date('2026-10-12T02:00:00Z');

let store: MemoryTemplateStore;
let storage: MemoryStorage;
let service: TemplateService;

beforeEach(() => {
  store = createMemoryTemplateStore();
  storage = createMemoryStorage();
  service = createTemplateService({ store, storage, now: () => NOW });
});

const pdf = (name = 'form.pdf') => ({ name, mimeType: PDF_MIME, bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]) });
const docx = (name = 'form.docx') => ({ name, mimeType: DOCX_MIME, bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]) });

describe('saveText', () => {
  test('creates the template on first save and trims the text', async () => {
    expect(
      await service.saveText({ employeeId: STAFF, sanctionId: 1, title: '  Violation slip  ', description: 'Read it', requirements: 'Sign it' }),
    ).toEqual({ ok: true });
    expect(store.readAll()[0]).toMatchObject({
      sanctionId: 1,
      templateId: 1,
      title: 'Violation slip',
      description: 'Read it',
      requirements: 'Sign it',
    });
  });

  test('saving again updates the same row; an empty field becomes null', async () => {
    await service.saveText({ employeeId: STAFF, sanctionId: 1, title: 'A', description: 'B', requirements: 'C' });
    await service.saveText({ employeeId: STAFF, sanctionId: 1, title: 'A2', description: '   ', requirements: undefined });
    expect(store.state.templates).toHaveLength(1);
    expect(store.readAll()[0]).toMatchObject({ title: 'A2', description: null, requirements: null });
  });

  test('is refused for an unknown sanction and for text that is too long', async () => {
    expect(await service.saveText({ employeeId: STAFF, sanctionId: 99, title: 'x', description: null, requirements: null })).toMatchObject({
      code: 'not_found',
    });
    expect(
      await service.saveText({ employeeId: STAFF, sanctionId: 1, title: 'x'.repeat(201), description: null, requirements: null }),
    ).toMatchObject({ code: 'invalid_input' });
    expect(
      await service.saveText({ employeeId: STAFF, sanctionId: 1, title: null, description: 'x'.repeat(2001), requirements: null }),
    ).toMatchObject({ code: 'invalid_input' });
    expect(
      await service.saveText({ employeeId: STAFF, sanctionId: 1, title: null, description: null, requirements: 'x'.repeat(4001) }),
    ).toMatchObject({ code: 'invalid_input' });
    expect(await service.saveText({ employeeId: STAFF, sanctionId: 1, title: 5 as unknown as string, description: null, requirements: null })).toMatchObject({
      code: 'invalid_input',
    });
    expect(store.state.templates).toHaveLength(0);
  });
});

describe('uploadFiles', () => {
  test('stores a PDF under templates/{sanction}/{uuid}.{ext} and links it to the template', async () => {
    const result = await service.uploadFiles({ employeeId: STAFF, sanctionId: 2, files: [pdf()] });
    expect(result).toMatchObject({ ok: true });
    const keys = [...storage.objects.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^templates\/2\/[0-9a-f-]{36}\.pdf$/);
    expect(store.readAll().find((t) => t.sanctionId === 2)?.files.map((f) => f.originalName)).toEqual(['form.pdf']);
  });

  test('uploading again replaces the file: one row, the old object is removed', async () => {
    await service.uploadFiles({ employeeId: STAFF, sanctionId: 2, files: [pdf()] });
    const [firstKey] = [...storage.objects.keys()];
    const second = await service.uploadFiles({ employeeId: STAFF, sanctionId: 2, files: [pdf('form.pdf')] });
    expect(second).toMatchObject({ ok: true });
    expect(storage.objects.has(firstKey)).toBe(false);
    expect(storage.objects.size).toBe(1);
    expect(store.readAll().find((t) => t.sanctionId === 2)?.files.map((f) => f.originalName)).toEqual(['form.pdf']);
  });

  test.each([
    ['an image', { name: 'a.png', mimeType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }, 'unsupported_type'],
    ['a PDF that is not a PDF', { name: 'a.pdf', mimeType: PDF_MIME, bytes: new Uint8Array([1, 2, 3]) }, 'content_mismatch'],
    ['an empty file', { name: 'a.pdf', mimeType: PDF_MIME, bytes: new Uint8Array([]) }, 'empty'],
    ['a file over 10 MB', { name: 'a.pdf', mimeType: PDF_MIME, bytes: new Uint8Array(MAX_FILE_BYTES + 1).fill(0x25) }, 'too_large'],
  ])('refuses %s and stores nothing', async (_label, file, code) => {
    expect(await service.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [file] })).toMatchObject({ ok: false, code });
    expect(storage.objects.size).toBe(0);
    expect(store.state.files).toHaveLength(0);
  });

  test('PDF only (D7): a DOCX template is refused with "is not a PDF file." and nothing is stored', async () => {
    expect(await service.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [docx()] })).toMatchObject({
      ok: false,
      code: 'unsupported_type',
      message: 'form.docx is not a PDF file.',
    });
    expect(storage.objects.size).toBe(0);
  });

  test('a second file in one request is refused and nothing is stored', async () => {
    expect(await service.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [pdf('1.pdf'), pdf('2.pdf')] })).toMatchObject({
      ok: false,
      code: 'too_many_files',
    });
    expect(storage.objects.size).toBe(0);
    expect(store.state.files).toHaveLength(0);
  });

  test('an unknown sanction and an empty request are refused', async () => {
    expect(await service.uploadFiles({ employeeId: STAFF, sanctionId: 99, files: [pdf()] })).toMatchObject({ code: 'not_found' });
    expect(await service.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [] })).toMatchObject({ code: 'invalid_input' });
  });

  test('if the database write fails the stored objects are removed again', async () => {
    const broken = createTemplateService({
      store: { ...store, transaction: () => Promise.reject(new Error('db down')) },
      storage,
      now: () => NOW,
    });
    await expect(broken.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [pdf()] })).rejects.toThrow('db down');
    expect(storage.objects.size).toBe(0);
  });
});

describe('replace failure', () => {
  test('if the replacing write fails the old row and object stay and the new object is removed', async () => {
    await service.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [pdf('old.pdf')] });
    const [oldKey] = [...storage.objects.keys()];
    let calls = 0;
    const flaky = createTemplateService({
      store: {
        ...store,
        transaction: (work) => (++calls === 1 ? store.transaction(work) : Promise.reject(new Error('db down'))),
      },
      storage,
      now: () => NOW,
    });
    await expect(flaky.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [pdf()] })).rejects.toThrow('db down');
    expect([...storage.objects.keys()]).toEqual([oldKey]);
    expect(store.readAll().find((t) => t.sanctionId === 1)?.files.map((f) => f.originalName)).toEqual(['old.pdf']);
  });
});

describe('removeFile', () => {
  test('deletes the row and the object', async () => {
    await service.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [pdf()] });
    expect(await service.removeFile({ employeeId: STAFF, fileId: 1 })).toEqual({ ok: true });
    expect(store.state.files).toHaveLength(0);
    expect(storage.objects.size).toBe(0);
  });

  test('an unknown file is not found', async () => {
    expect(await service.removeFile({ employeeId: STAFF, fileId: 9 })).toMatchObject({ code: 'not_found' });
  });
});

describe('downloadUrl', () => {
  test('returns a short-lived link for an existing file', async () => {
    await service.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [pdf()] });
    const result = await service.downloadUrl({ fileId: 1 });
    expect(result).toMatchObject({ ok: true, expiresInSeconds: 60 });
    if (result.ok) expect(result.url).toContain('templates/1/');
  });

  test('an unknown file is not found', async () => {
    expect(await service.downloadUrl({ fileId: 5 })).toMatchObject({ code: 'not_found' });
  });
});
