import { describe, expect, test } from 'vitest';
import { lockLabel, loginErrors, wrongCredentials } from '@/utils/account';

describe('loginErrors: one message per field', () => {
  test('empty email and empty password', () => {
    expect(loginErrors('', '')).toEqual({ email: 'Enter your NU email.', password: 'Enter your password.' });
  });

  test('a malformed address is told apart from a non-NU domain', () => {
    expect(loginErrors('not-an-email', 'x').email).toMatch(/valid email/);
    expect(loginErrors('jd@gmail.com', 'x').email).toMatch(/nu-fairview\.edu\.ph/);
  });

  test('both NU domains pass', () => {
    expect(loginErrors('jd@students.nu-fairview.edu.ph', 'pw')).toEqual({});
    expect(loginErrors(' AM@nu-fairview.edu.ph ', 'pw')).toEqual({});
  });
});

describe('wrongCredentials and lockLabel', () => {
  test('counts the attempts left before the pause', () => {
    expect(wrongCredentials(1)).toBe('The email or password is incorrect. 4 attempts left before sign-in is paused.');
    expect(wrongCredentials(4)).toBe('The email or password is incorrect. 1 attempt left before sign-in is paused.');
  });

  test('the button label counts down as m:ss', () => {
    expect(lockLabel(60)).toBe('Try again in 1:00');
    expect(lockLabel(42)).toBe('Try again in 0:42');
    expect(lockLabel(5)).toBe('Try again in 0:05');
  });
});
