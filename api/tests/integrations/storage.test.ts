import { describe, expect, test } from 'vitest';
import { createMemoryStorage } from '../../src/integrations/storage/memory.js';
import { PRESIGN_TTL_SECONDS, proofKey, templateKey } from '../../src/integrations/storage/types.js';

describe('storage keys', () => {
  test('proof key follows proof/{case_sanction_id}/{uuid}.{ext}', () => {
    expect(proofKey(12, 'pdf', () => 'abc')).toBe('proof/12/abc.pdf');
  });

  test('template key follows templates/{sanction_id}/{uuid}.{ext}', () => {
    expect(templateKey(3, 'docx', () => 'xyz')).toBe('templates/3/xyz.docx');
  });

  test('default uuid makes keys unique', () => {
    expect(proofKey(1, 'pdf')).not.toBe(proofKey(1, 'pdf'));
  });
});

describe('memory storage fake', () => {
  test('put then presignGet returns a URL carrying the key and a 60 s TTL', async () => {
    const storage = createMemoryStorage();
    await storage.put('proof/1/a.pdf', new Uint8Array([1]), 'application/pdf');
    const url = await storage.presignGet('proof/1/a.pdf');
    expect(url).toContain('proof/1/a.pdf');
    expect(url).toContain(`expires=${PRESIGN_TTL_SECONDS}`);
  });

  test('presignGet on a missing key rejects', async () => {
    await expect(createMemoryStorage().presignGet('nope')).rejects.toThrow(/not found/i);
  });

  test('delete removes the object and is idempotent', async () => {
    const storage = createMemoryStorage();
    await storage.put('k', new Uint8Array([1]), 'application/pdf');
    await storage.delete('k');
    await storage.delete('k');
    expect(storage.objects.has('k')).toBe(false);
  });
});
