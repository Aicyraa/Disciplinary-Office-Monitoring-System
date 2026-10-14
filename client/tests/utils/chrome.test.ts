import { describe, expect, test } from 'vitest';
import { accountRows, bellFooter } from '@/utils/account';
import { passwordChangeError, passwordRules } from '@/validators/account';

describe('passwordRules (src 2177): the live checklist', () => {
  test('two rules, each ticked when met', () => {
    expect(passwordRules('abc')).toEqual([
      { text: 'At least 8 characters', ok: false },
      { text: 'Letters and at least one number', ok: false },
    ]);
    expect(passwordRules('abcdefg1').every((rule) => rule.ok)).toBe(true);
    expect(passwordRules('12345678')[1].ok).toBe(false);
  });
});

describe('passwordChangeError (src 3404), first problem wins', () => {
  const ok = { current: 'Old-pass1', next: 'NewPass22', confirm: 'NewPass22' };
  test.each([
    [{ ...ok, current: '' }, 'Enter your current password.'],
    [{ ...ok, next: 'short1', confirm: 'short1' }, 'Your new password doesn’t meet the rules below.'],
    [{ ...ok, confirm: 'NewPass23' }, 'The new passwords don’t match.'],
    [{ ...ok, next: 'Old-pass1', confirm: 'Old-pass1' }, 'Choose a password you haven’t just used.'],
  ])('%o', (input, message) => {
    expect(passwordChangeError(input)).toBe(message);
  });
  test('all good', () => {
    expect(passwordChangeError(ok)).toBeNull();
  });
});
import { notificationLook, notificationWhen, notificationWhenLong } from '@/utils/inbox';

describe('notificationLook (src 2238 to 2242, 3318)', () => {
  test('icon, category label and tint per kind', () => {
    expect(notificationLook('report')).toEqual({ icon: 'flag', category: 'Violations', tint: 'bg-bad-soft text-bad-ink' });
    expect(notificationLook('esc')).toEqual({ icon: 'trending_up', category: 'Violations', tint: 'bg-bad-soft text-bad-ink' });
    expect(notificationLook('sanction')).toEqual({ icon: 'assignment', category: 'Sanctions', tint: 'bg-amber-soft text-amber-ink' });
    expect(notificationLook('appt')).toEqual({ icon: 'event', category: 'Appointments', tint: 'bg-info-soft text-info-ink' });
    expect(notificationLook('notice')).toEqual({ icon: 'campaign', category: 'Important notice', tint: 'bg-pending-soft text-warn-ink' });
    expect(notificationLook('account')).toEqual({ icon: 'key', category: 'Account', tint: 'bg-neutral-soft text-neutral-ink' });
    expect(notificationLook('clr').icon).toBe('task_alt');
  });
});

describe('notification times in Asia/Manila', () => {
  test('short: "Fri, Oct 9 · 10:40 AM"', () => {
    expect(notificationWhen('2026-10-09T02:40:00.000Z')).toBe('Fri, Oct 9 · 10:40 AM');
  });
  test('long, in the message dialog: "Wednesday, October 7, 2026 · 3:15 PM"', () => {
    expect(notificationWhenLong('2026-10-07T07:15:00.000Z')).toBe('Wednesday, October 7, 2026 · 3:15 PM');
  });
});

describe('accountRows (src 3489; first name instead of username, D10)', () => {
  const user = { role: 'student' as const, id: '2025-1234567', firstName: 'Juan', lastName: 'Dela Cruz', email: 'jdc@students.nu-fairview.edu.ph' };

  test('student', () => {
    expect(
      accountRows(user, { studentId: '2025-1234567', firstName: 'Juan', lastName: 'Dela Cruz', email: user.email, program: 'BSIT', yearLevel: 3, isActive: true }),
    ).toEqual([
      ['First name', 'Juan'],
      ['Student ID', '2025-1234567'],
      ['Program', 'BSIT · 3rd Year'],
      ['School email', 'jdc@students.nu-fairview.edu.ph'],
      ['Notifications', 'In the app and by email (Outlook)'],
    ]);
  });

  test('staff', () => {
    expect(accountRows({ role: 'staff', firstName: 'Andrea', email: 'am@nu-fairview.edu.ph' }, null)).toEqual([
      ['First name', 'Andrea'],
      ['Work email', 'am@nu-fairview.edu.ph'],
      ['Role', 'SDO Officer'],
    ]);
  });
});

describe('bellFooter (D11)', () => {
  test('staff and students are told where else the update went', () => {
    expect(bellFooter('staff')).toBe('Also sent to your work email');
    expect(bellFooter('student')).toBe('Also sent to your school email');
  });
});
