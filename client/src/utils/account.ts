import type { AccountRole, AuthUser, StudentProfileView } from '@shared/types';

const ordinalYear = (level: number): string =>
  `${level}${level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th'} Year`;

/** The rows of the Account details modal (deck src 3489). The first name stands in for the deck's username (D10). */
export function accountRows(
  user: Pick<AuthUser, 'role' | 'firstName' | 'email'>,
  profile: StudentProfileView | null,
): Array<[string, string]> {
  if (user.role === 'staff') {
    return [
      ['First name', user.firstName],
      ['Work email', user.email],
      ['Role', 'SDO Officer'],
    ];
  }
  return [
    ['First name', profile?.firstName ?? user.firstName],
    ['Student ID', profile?.studentId ?? '—'],
    ['Program', profile ? `${profile.program} · ${ordinalYear(profile.yearLevel)}` : '—'],
    ['School email', profile?.email ?? user.email],
    ['Notifications', 'In the app and by email (Outlook)'],
  ];
}

/** The live rule list under the new password (deck src 2177). The API checks the same rules (SPEC 4.8). */
export function passwordRules(password: string): Array<{ text: string; ok: boolean }> {
  return [
    { text: 'At least 8 characters', ok: password.length >= 8 },
    { text: 'Letters and at least one number', ok: /[A-Za-z]/.test(password) && /\d/.test(password) },
  ];
}

/** The one alert above the Change password form (deck src 3404); null when the form can be sent. */
export function passwordChangeError({ current, next, confirm }: { current: string; next: string; confirm: string }): string | null {
  if (current === '') return 'Enter your current password.';
  if (!passwordRules(next).every((rule) => rule.ok)) return 'Your new password doesn’t meet the rules below.';
  if (next !== confirm) return 'The new passwords don’t match.';
  if (next === current) return 'Choose a password you haven’t just used.';
  return null;
}

/** Sign-in checks before calling the API (deck src 2548). The API stays the authority on the account. */
export function loginProblem(email: string, password: string): string | null {
  const address = email.trim().toLowerCase();
  if (address !== '' && !/@(students\.)?nu-fairview\.edu\.ph$/.test(address)) return 'Use your NU email (ending in nu-fairview.edu.ph).';
  if (address === '' || password === '') return 'Enter your NU email and password.';
  return null;
}

/** "Set a new password" after a temporary password (deck src 3420). Reuse of the temporary one is the API's check. */
export function forcedPasswordError(next: string, confirm: string): string | null {
  if (!passwordRules(next).every((rule) => rule.ok)) return 'Your new password doesn’t meet the rules below.';
  if (next !== confirm) return 'The passwords don’t match.';
  return null;
}

/** The line at the bottom of the bell popover (deck src 3482; staff have the bell too, D11). */
export function bellFooter(role: AccountRole): string {
  return role === 'staff' ? 'Also sent to your work email' : 'Also sent to your school email';
}
