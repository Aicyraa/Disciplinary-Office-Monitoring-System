import { describe, expect, test } from 'vitest';
import { resolveApiBaseUrl } from './apiBase';

const page = (hostname: string, protocol = 'http:') => ({ hostname, protocol });

describe('resolveApiBaseUrl', () => {
  test('without a configured URL the API is on the page host at the API port', () => {
    expect(resolveApiBaseUrl({ page: page('127.0.0.1'), port: '3000' })).toBe('http://127.0.0.1:3000');
    expect(resolveApiBaseUrl({ page: page('localhost'), port: '3000' })).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl({ page: page('[::1]'), port: '3001' })).toBe('http://[::1]:3001');
  });

  test('without a page (tests, server rendering) it falls back to localhost', () => {
    expect(resolveApiBaseUrl({ port: '3000' })).toBe('http://localhost:3000');
    expect(resolveApiBaseUrl({ configured: 'http://localhost:4000', port: '3000' })).toBe('http://localhost:4000');
  });

  test('a configured loopback URL follows the loopback spelling the page was opened with', () => {
    expect(resolveApiBaseUrl({ configured: 'http://localhost:3000', page: page('127.0.0.1'), port: '3000' })).toBe(
      'http://127.0.0.1:3000',
    );
    expect(resolveApiBaseUrl({ configured: 'http://127.0.0.1:3000', page: page('localhost'), port: '3000' })).toBe(
      'http://localhost:3000',
    );
  });

  test('the configured port and scheme are kept', () => {
    expect(resolveApiBaseUrl({ configured: 'https://localhost:8443', page: page('127.0.0.1', 'https:'), port: '3000' })).toBe(
      'https://127.0.0.1:8443',
    );
  });

  test('a configured address that matches the page is returned as given', () => {
    expect(resolveApiBaseUrl({ configured: 'http://localhost:3000', page: page('localhost'), port: '3000' })).toBe(
      'http://localhost:3000',
    );
  });

  test('a real (non-loopback) API address is never rewritten, whatever the page host is', () => {
    expect(resolveApiBaseUrl({ configured: 'https://api.sdo.example.edu', page: page('127.0.0.1'), port: '3000' })).toBe(
      'https://api.sdo.example.edu',
    );
    expect(resolveApiBaseUrl({ configured: 'http://localhost:3000', page: page('sdo.example.edu'), port: '3000' })).toBe(
      'http://localhost:3000',
    );
  });

  test('an unparsable configured value is returned unchanged', () => {
    expect(resolveApiBaseUrl({ configured: 'not a url', page: page('127.0.0.1'), port: '3000' })).toBe('not a url');
  });
});
