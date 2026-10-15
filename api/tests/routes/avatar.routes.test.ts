import request from 'supertest';
import { beforeEach, describe, expect, test } from 'vitest';
import { createMemoryStorage, type MemoryStorage } from '../../src/integrations/storage/memory.js';
import { buildHarnessApp, signedInAgent, STAFF, STUDENT_A, STUDENT_B, STUDENT_TEMP } from '../helpers/harness.js';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

let storage: MemoryStorage;
const build = () => buildHarnessApp({ avatarStorage: storage });

beforeEach(() => {
  storage = createMemoryStorage();
});

describe('access control', () => {
  test('PUT and DELETE need a session (401)', async () => {
    const app = build();
    expect((await request(app).put('/me/avatar').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })).status).toBe(401);
    expect((await request(app).delete('/me/avatar')).status).toBe(401);
  });

  test('an account that must change its password first is refused (403)', async () => {
    const agent = await signedInAgent(build(), STUDENT_TEMP.email);
    const response = await agent.put('/me/avatar').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(response.status).toBe(403);
  });
});

describe('PUT /me/avatar', () => {
  test('a student sets a picture: stored under avatars/student/<id>/, linked on the user, key never exposed', async () => {
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const response = await agent.put('/me/avatar').attach('file', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(response.status).toBe(200);
    expect(response.body.data.user.avatarUrl).toMatch(/^memory:\/\/avatars\/student\/2025-0000001\/.+\.png/);
    expect(JSON.stringify(response.body)).not.toContain('avatar_key');
    expect([...storage.objects.keys()]).toHaveLength(1);
    expect([...storage.objects.values()][0]?.contentType).toBe('image/png');

    const me = await agent.get('/auth/me');
    expect(me.body.data.user.avatarUrl).toBe(response.body.data.user.avatarUrl);
  });

  test('staff set their own picture under avatars/employee/<id>/', async () => {
    const agent = await signedInAgent(build(), STAFF.email);
    const response = await agent.put('/me/avatar').attach('file', JPG, { filename: 'x.jpg', contentType: 'image/jpeg' });
    expect(response.status).toBe(200);
    expect([...storage.objects.keys()][0]).toMatch(/^avatars\/employee\/E001\/.+\.jpg$/);
  });

  test('a new picture replaces the old one and the old object is deleted', async () => {
    const agent = await signedInAgent(build(), STUDENT_A.email);
    await agent.put('/me/avatar').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });
    const [first] = [...storage.objects.keys()];
    await agent.put('/me/avatar').attach('file', JPG, { filename: 'b.jpg', contentType: 'image/jpeg' });
    const keys = [...storage.objects.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toBe(first);
    expect(keys[0]).toMatch(/\.jpg$/);
  });

  test("one person's picture never touches another's", async () => {
    const app = build();
    const a = await signedInAgent(app, STUDENT_A.email);
    const b = await signedInAgent(app, STUDENT_B.email);
    await a.put('/me/avatar').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect((await b.get('/auth/me')).body.data.user.avatarUrl).toBeNull();
    await b.delete('/me/avatar');
    expect((await a.get('/auth/me')).body.data.user.avatarUrl).not.toBeNull();
  });

  test('refusals: no file, wrong type, a renamed file, too big', async () => {
    const agent = await signedInAgent(build(), STUDENT_A.email);
    const none = await agent.put('/me/avatar');
    expect(none.status).toBe(400);
    expect(none.body.error.code).toBe('invalid_input');

    const pdf = await agent.put('/me/avatar').attach('file', Buffer.from('%PDF-1.7'), { filename: 'a.pdf', contentType: 'application/pdf' });
    expect(pdf.status).toBe(400);
    expect(pdf.body.error.code).toBe('unsupported_type');

    const renamed = await agent.put('/me/avatar').attach('file', Buffer.from('%PDF-1.7'), { filename: 'a.png', contentType: 'image/png' });
    expect(renamed.status).toBe(400);
    expect(renamed.body.error.code).toBe('content_mismatch');

    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    const tooBig = await agent.put('/me/avatar').attach('file', big, { filename: 'big.png', contentType: 'image/png' });
    expect(tooBig.status).toBe(413);
    expect(tooBig.body.error.code).toBe('too_large');

    expect(storage.objects.size).toBe(0);
  });
});

describe('DELETE /me/avatar', () => {
  test('removes the picture and its object; removing none is fine', async () => {
    const agent = await signedInAgent(build(), STAFF.email);
    await agent.put('/me/avatar').attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });
    const removed = await agent.delete('/me/avatar');
    expect(removed.status).toBe(200);
    expect(removed.body.data.user.avatarUrl).toBeNull();
    expect(storage.objects.size).toBe(0);

    const again = await agent.delete('/me/avatar');
    expect(again.status).toBe(200);
  });
});
