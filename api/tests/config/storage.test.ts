import { describe, expect, test } from 'vitest';
import {
  DEFAULT_FILES_BUCKET,
  DEFAULT_TEMPLATES_BUCKET,
  filesBucketFromEnv,
  templatesBucketFromEnv,
} from '../../src/config/storage.js';

describe('filesBucketFromEnv (proof files students upload)', () => {
  test('STORAGE_BUCKET_FILES is the name', () => {
    expect(filesBucketFromEnv({ STORAGE_BUCKET_FILES: 'proofs' })).toBe('proofs');
  });

  test('earlier spellings still work, newest first', () => {
    expect(filesBucketFromEnv({ BUCKET_STORAGE_FILES: 'a', BUCKET_STORAGE: 'b', STORAGE_BUCKET: 'c' })).toBe('a');
    expect(filesBucketFromEnv({ BUCKET_STORAGE: 'b', STORAGE_BUCKET: 'c' })).toBe('b');
    expect(filesBucketFromEnv({ STORAGE_BUCKET: 'c' })).toBe('c');
    expect(filesBucketFromEnv({ STORAGE_BUCKET_FILES: 'new', BUCKET_STORAGE_FILES: 'old' })).toBe('new');
  });

  test('blank or missing is undefined, surrounding spaces are not part of the name', () => {
    expect(filesBucketFromEnv({})).toBeUndefined();
    expect(filesBucketFromEnv({ STORAGE_BUCKET_FILES: '   ' })).toBeUndefined();
    expect(filesBucketFromEnv({ STORAGE_BUCKET_FILES: ' proofs ' })).toBe('proofs');
  });
});

describe('templatesBucketFromEnv (sanction templates staff upload, step 8)', () => {
  test('STORAGE_BUCKET_TEMPLATES is the name, BUCKET_STORAGE_TEMPLATES the earlier spelling', () => {
    expect(templatesBucketFromEnv({ STORAGE_BUCKET_TEMPLATES: 'templates' })).toBe('templates');
    expect(templatesBucketFromEnv({ BUCKET_STORAGE_TEMPLATES: 'old' })).toBe('old');
  });

  test('it never falls back to the files bucket', () => {
    expect(templatesBucketFromEnv({ STORAGE_BUCKET_FILES: 'proofs' })).toBeUndefined();
  });
});

describe('defaults', () => {
  test('match the names in .env.example', () => {
    expect(DEFAULT_FILES_BUCKET).toBe('assets-files');
    expect(DEFAULT_TEMPLATES_BUCKET).toBe('assets-sanction-templates');
  });
});
