import { beforeEach, describe, expect, test } from 'vitest';
import { DOCX_MIME, MAX_FILE_BYTES, PDF_MIME } from '../files/validate.js';
import { createMemoryStorage, type MemoryStorage } from '../storage/memory.js';
import { createMemoryTemplateStore, type MemoryTemplateStore } from './memory-store.js';
import { createTemplateService, type TemplateService } from './service.js';

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
  test('stores PDF and DOCX under templates/{sanction}/{uuid}.{ext} and links them to the template', async () => {
    const result = await service.uploadFiles({ employeeId: STAFF, sanctionId: 2, files: [pdf(), docx()] });
    expect(result).toMatchObject({ ok: true });
    const keys = [...storage.objects.keys()];
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^templates\/2\/[0-9a-f-]{36}\.pdf$/);
    expect(keys[1]).toMatch(/^templates\/2\/[0-9a-f-]{36}\.docx$/);
    expect(store.readAll().find((t) => t.sanctionId === 2)?.files.map((f) => f.originalName)).toEqual(['form.pdf', 'form.docx']);
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

  test('at most 5 files per template, counting the ones already there', async () => {
    await service.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [pdf('1.pdf'), pdf('2.pdf'), pdf('3.pdf'), pdf('4.pdf')] });
    expect(await service.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [pdf('5.pdf'), pdf('6.pdf')] })).toMatchObject({
      ok: false,
      code: 'too_many_files',
    });
    expect(storage.objects.size).toBe(4);
    expect(await service.uploadFiles({ employeeId: STAFF, sanctionId: 1, files: [pdf('5.pdf')] })).toMatchObject({ ok: true });
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
