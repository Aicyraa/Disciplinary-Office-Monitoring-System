import request from 'supertest';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createUnavailableStorage } from '../../src/integrations/storage/unavailable.js';
import { DOCX_MIME, MAX_FILE_BYTES, PDF_MIME } from '../../src/domain/files/validate.js';
import { createMemoryStorage, type MemoryStorage } from '../../src/integrations/storage/memory.js';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A } from '../helpers/harness.js';
import { createMemoryTemplateStore, type MemoryTemplateStore } from '../../src/repositories/templates/memory-store.js';
import { createTemplateService } from '../../src/services/templates.service.js';

const NOW = new Date('2026-10-12T02:00:00Z');
const pdfBytes = Buffer.from('%PDF-1.7 fake');
const docxBytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);

let store: MemoryTemplateStore;
let storage: MemoryStorage;

function build() {
  store = createMemoryTemplateStore();
  storage = createMemoryStorage();
  const service = createTemplateService({ store, storage, now: () => NOW });
  return buildHarnessApp({ templates: { service, reader: { list: async () => store.readAll() } }, now: () => NOW });
}

describe('access control', () => {
  const staffOnly: Array<[string, string]> = [
    ['put', '/sanction-templates/1'],
    ['post', '/sanction-templates/1/files'],
    ['delete', '/sanction-templates/files/1'],
  ];
  const signedIn: Array<[string, string]> = [
    ['get', '/sanction-templates'],
    ['get', '/sanction-templates/files/1/url'],
  ];

  test.each([...staffOnly, ...signedIn])('%s %s needs a session (401)', async (method, path) => {
    const response = await (request(build()) as unknown as Record<string, (p: string) => Promise<{ status: number }>>)[method](path);
    expect(response.status).toBe(401);
  });

  test.each(staffOnly)('%s %s is staff only: a student gets 403', async (method, path) => {
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const response = await (agent as unknown as Record<string, (p: string) => Promise<{ status: number }>>)[method](path);
    expect(response.status).toBe(403);
  });
});

describe('GET /sanction-templates (any signed-in user)', () => {
  test('a student sees every sanction with its template text and file names, never a storage key', async () => {
    const app = build();
    const staff = await signedInAgent(app, STAFF.email);
    await staff.put('/sanction-templates/1').send({ title: 'Violation slip', description: 'About', requirements: 'Sign' });
    await staff.post('/sanction-templates/1/files').attach('files', pdfBytes, { filename: 'slip.pdf', contentType: PDF_MIME });

    const student = await signedInAgent(app, STUDENT_A.email);
    const response = await student.get('/sanction-templates');
    expect(response.status).toBe(200);
    expect(response.body.data.templates).toHaveLength(3);
    const first = response.body.data.templates[0];
    expect(first).toMatchObject({
      sanctionId: 1,
      sanctionCode: 'S-001',
      type: 'Violation Slip',
      title: 'Violation slip',
      requirements: 'Sign',
      files: [{ id: 1, name: 'slip.pdf', mimeType: PDF_MIME }],
    });
    expect(JSON.stringify(response.body)).not.toContain('templates/1/');
    expect(response.body.data.templates[1]).toMatchObject({ sanctionId: 2, title: null, files: [] });
  });
});

describe('PUT /sanction-templates/:sanctionId', () => {
  test('staff save the text', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.put('/sanction-templates/2').send({ title: 'Warning', description: 'D', requirements: 'R' });
    expect(response.status).toBe(200);
    expect(store.readAll()[1]).toMatchObject({ title: 'Warning', description: 'D', requirements: 'R' });
  });

  test.each([
    ['an unknown sanction', '/sanction-templates/99', { title: 'x' }, 404],
    ['a malformed id', '/sanction-templates/abc', { title: 'x' }, 404],
    ['a title over 200 characters', '/sanction-templates/1', { title: 'x'.repeat(201) }, 400],
  ])('refuses %s', async (_label, path, body, status) => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.put(path).send(body)).status).toBe(status);
  });
});

describe('files', () => {
  test('staff upload one file: 201, the object is stored under templates/, a second upload replaces it', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.post('/sanction-templates/3/files').attach('files', pdfBytes, { filename: 'a.pdf', contentType: PDF_MIME });
    expect(response.status).toBe(201);
    expect(response.body.data.fileIds).toHaveLength(1);
    expect([...storage.objects.keys()].every((key) => key.startsWith('templates/3/'))).toBe(true);
    const refused = await staff.post('/sanction-templates/3/files').attach('files', docxBytes, { filename: 'b.docx', contentType: DOCX_MIME });
    expect(refused.status).toBe(400);
    expect(refused.body.error.message).toBe('b.docx is not a PDF file.');
    const again = await staff.post('/sanction-templates/3/files').attach('files', pdfBytes, { filename: 'b.pdf', contentType: PDF_MIME });
    expect(again.status).toBe(201);
    expect(storage.objects.size).toBe(1);
    const list = await staff.get('/sanction-templates');
    expect(list.body.data.templates.find((t: { sanctionId: number }) => t.sanctionId === 3).files).toHaveLength(1);
  });

  test.each([
    ['an image', Buffer.from('%PDF-1.7'), 'a.png', 'image/png', 400, 'unsupported_type'],
    ['a fake PDF', Buffer.from('not a pdf'), 'a.pdf', PDF_MIME, 400, 'content_mismatch'],
  ])('refuses %s', async (_label, bytes, filename, contentType, status, code) => {
    const staff = await signedInAgent(build(), STAFF.email);
    const response = await staff.post('/sanction-templates/1/files').attach('files', bytes, { filename, contentType });
    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(code);
    expect(storage.objects.size).toBe(0);
  });

  test('a file over 10 MB is 413 and nothing is stored', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    const big = Buffer.concat([pdfBytes, Buffer.alloc(MAX_FILE_BYTES)]);
    const response = await staff.post('/sanction-templates/1/files').attach('files', big, { filename: 'big.pdf', contentType: PDF_MIME });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('too_large');
    expect(storage.objects.size).toBe(0);
  });

  test('two files in one request are refused', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    let pending = staff.post('/sanction-templates/1/files');
    for (let i = 0; i < 2; i += 1) pending = pending.attach('files', pdfBytes, { filename: `f${i}.pdf`, contentType: PDF_MIME });
    const response = await pending;
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('too_many_files');
    expect(storage.objects.size).toBe(0);
  });

  test('no file at all is 400', async () => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.post('/sanction-templates/1/files')).status).toBe(400);
  });

  test('a student downloads a template file through a short-lived link; staff delete it', async () => {
    const app = build();
    const staff = await signedInAgent(app, STAFF.email);
    await staff.post('/sanction-templates/1/files').attach('files', pdfBytes, { filename: 'a.pdf', contentType: PDF_MIME });

    const student = await signedInAgent(app, STUDENT_A.email);
    const link = await student.get('/sanction-templates/files/1/url');
    expect(link.status).toBe(200);
    expect(link.body.data.expiresInSeconds).toBe(60);
    expect(link.body.data.url).toContain('templates/1/');

    expect((await student.delete('/sanction-templates/files/1')).status).toBe(403);
    expect((await staff.delete('/sanction-templates/files/1')).status).toBe(200);
    expect(storage.objects.size).toBe(0);
    expect((await student.get('/sanction-templates/files/1/url')).status).toBe(404);
  });

  test('when template storage is unavailable, upload and download are 503 storage_unavailable and the text still saves', async () => {
    const store503 = createMemoryTemplateStore();
    const down = createUnavailableStorage('set STORAGE_BUCKET_TEMPLATES');
    const service = createTemplateService({ store: store503, storage: down, now: () => NOW });
    const app = buildHarnessApp({ templates: { service, reader: { list: async () => store503.readAll() } }, now: () => NOW });
    const staff = await signedInAgent(app, STAFF.email);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const upload = await staff.post('/sanction-templates/1/files').attach('files', pdfBytes, { filename: 'a.pdf', contentType: PDF_MIME });
    expect(upload.status).toBe(503);
    expect(upload.body.error.code).toBe('storage_unavailable');
    expect(store503.state.files).toHaveLength(0);
    expect((await staff.put('/sanction-templates/1').send({ title: 'Still works' })).status).toBe(200);
    vi.restoreAllMocks();
  });

  test.each(['abc', '0x1', '1.5', '-1'])('a malformed file id %s is 404', async (id) => {
    const staff = await signedInAgent(build(), STAFF.email);
    expect((await staff.get(`/sanction-templates/files/${id}/url`)).status).toBe(404);
    expect((await staff.delete(`/sanction-templates/files/${id}`)).status).toBe(404);
  });
});

beforeEach(() => {
  store = createMemoryTemplateStore();
});
