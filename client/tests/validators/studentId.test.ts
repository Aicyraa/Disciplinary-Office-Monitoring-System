import { describe, expect, test } from 'vitest';
import { isStudentId } from '@/validators/studentId';

describe('student id format (SPEC 3)', () => {
  test('accepts four digits, a dash, seven digits', () => {
    expect(isStudentId('2025-1234567')).toBe(true);
  });

  test('rejects anything else', () => {
    for (const value of ['', '2025-123', '20251234567', '2025-12345678', 'abcd-1234567', ' 2025-1234567']) {
      expect(isStudentId(value)).toBe(false);
    }
  });
});
