import { describe, expect, test } from 'vitest';
import { clientOriginFrom, defaultClientOrigin } from '../../src/middleware/cors.js';

describe('defaultClientOrigin', () => {
  test('is http://localhost on the client port, defaulting to 5173', () => {
    expect(defaultClientOrigin(undefined)).toBe('http://localhost:5173');
    expect(defaultClientOrigin('5200')).toBe('http://localhost:5200');
    expect(defaultClientOrigin(5300)).toBe('http://localhost:5300');
  });
});

describe('clientOriginFrom', () => {
  test.each([
    ['http://localhost:5173', 'http://localhost:5173'],
    ['http://localhost:5173/', 'http://localhost:5173'],
    ['HTTP://Localhost:5173', 'http://localhost:5173'],
    ['https://sdo.example.edu', 'https://sdo.example.edu'],
    ['https://sdo.example.edu:443/app', 'https://sdo.example.edu'],
  ])('%s -> %s (the exact string a browser sends as Origin)', (value, expected) => {
    expect(clientOriginFrom(value)).toBe(expected);
  });

  test.each(['localhost:5173', '127.0.0.1:5173', 'not a url', 'null', '', 'ftp://localhost:5173', 'file:///tmp/x', 'javascript:alert(1)'])(
    '%j is not an http(s) origin',
    (value) => {
      // `new URL('localhost:5173')` parses with scheme "localhost:" and origin "null": it must not be accepted.
      expect(clientOriginFrom(value)).toBeNull();
    },
  );
});
