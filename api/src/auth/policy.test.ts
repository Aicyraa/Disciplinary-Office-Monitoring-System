import { describe, expect, test } from 'vitest';
import { checkPasswordRules, generateTempPassword, roleForEmail, STUDENT_ID_PATTERN } from './policy.js';

describe('roleForEmail', () => {
  test('student domain maps to student', () => {
    expect(roleForEmail('ana@students.nu-fairview.edu.ph')).toBe('student');
  });

  test('staff domain maps to staff', () => {
    expect(roleForEmail('Officer@NU-Fairview.edu.ph')).toBe('staff');
  });

  test.each(['x@gmail.com', 'x@evil-nu-fairview.edu.ph', 'x@nu-fairview.edu.ph.evil.com', 'x@sub.nu-fairview.edu.ph', ''])(
    'rejects %s',
    (email) => {
      expect(roleForEmail(email)).toBeNull();
    },
  );
});

describe('checkPasswordRules', () => {
  test('accepts 8+ chars with a letter and a digit', () => {
    expect(checkPasswordRules('abcdef12')).toBeNull();
  });

  test.each(['abc1', 'abcdefgh', '12345678'])('rejects %s', (password) => {
    expect(checkPasswordRules(password)).not.toBeNull();
  });
});

describe('generateTempPassword', () => {
  test('is Temp- plus four digits, zero padded', () => {
    expect(generateTempPassword(() => 7)).toBe('Temp-0007');
    expect(generateTempPassword()).toMatch(/^Temp-\d{4}$/);
  });
});

describe('STUDENT_ID_PATTERN', () => {
  test('matches YYYY-NNNNNNN only', () => {
    expect(STUDENT_ID_PATTERN.test('2025-1030808')).toBe(true);
    expect(STUDENT_ID_PATTERN.test('2025-103080')).toBe(false);
    expect(STUDENT_ID_PATTERN.test('E001')).toBe(false);
  });
});
