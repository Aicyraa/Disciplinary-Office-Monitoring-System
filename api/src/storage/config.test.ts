import { describe, expect, test } from 'vitest';
import { filesBucketFromEnv, templatesBucketFromEnv } from './config.js';

describe('filesBucketFromEnv (proof files students upload)', () => {
  test('BUCKET_STORAGE_FILES is the name', () => {
    expect(filesBucketFromEnv({ BUCKET_STORAGE_FILES: 'proofs' })).toBe('proofs');
  });

  test('older names still work, newest first: BUCKET_STORAGE, then STORAGE_BUCKET', () => {
    expect(filesBucketFromEnv({ BUCKET_STORAGE: 'b', STORAGE_BUCKET: 'c' })).toBe('b');
    expect(filesBucketFromEnv({ STORAGE_BUCKET: 'c' })).toBe('c');
    expect(filesBucketFromEnv({ BUCKET_STORAGE_FILES: 'a', BUCKET_STORAGE: 'b', STORAGE_BUCKET: 'c' })).toBe('a');
  });

  test('blank or missing is undefined, surrounding spaces and quotes are not part of the name', () => {
    expect(filesBucketFromEnv({})).toBeUndefined();
    expect(filesBucketFromEnv({ BUCKET_STORAGE_FILES: '   ' })).toBeUndefined();
    expect(filesBucketFromEnv({ BUCKET_STORAGE_FILES: ' proofs ' })).toBe('proofs');
  });
});

describe('templatesBucketFromEnv (sanction templates staff upload, step 8)', () => {
  test('BUCKET_STORAGE_TEMPLATES is the name; it never falls back to the files bucket', () => {
    expect(templatesBucketFromEnv({ BUCKET_STORAGE_TEMPLATES: 'templates' })).toBe('templates');
    expect(templatesBucketFromEnv({ BUCKET_STORAGE_FILES: 'proofs' })).toBeUndefined();
  });
});
