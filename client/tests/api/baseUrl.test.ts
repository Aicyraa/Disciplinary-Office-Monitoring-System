import { describe, expect, test } from 'vitest';
import { resolveApiBaseUrl } from '@/api/baseUrl';

describe('resolveApiBaseUrl', () => {
  test('defaults to http://localhost on the API port', () => {
    expect(resolveApiBaseUrl({ port: '3000' })).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl({ port: '3100' })).toBe('http://localhost:3100');
  });

  test('uses VITE_API_URL when it is set (a real deployment), without a trailing slash', () => {
    expect(resolveApiBaseUrl({ configured: 'https://api.sdo.example.edu/', port: '3000' })).toBe('https://api.sdo.example.edu');
  });

  test('an empty or blank VITE_API_URL counts as unset', () => {
    expect(resolveApiBaseUrl({ configured: '', port: '3000' })).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl({ configured: '   ', port: '3000' })).toBe('http://localhost:3000');
  });

  test('never guesses a host from the page: 127.0.0.1 is not rewritten or aliased', () => {
    expect(resolveApiBaseUrl({ configured: 'http://127.0.0.1:3000', port: '3000' })).toBe('http://127.0.0.1:3000');
  });
});
