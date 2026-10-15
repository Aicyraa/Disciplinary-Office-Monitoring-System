import type { AccountRole, AuthUser, StudentProfileView } from '@shared/types';

export const ordinalYear = (level: number): string =>
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

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCK_SECONDS = 60;

/** The red banner after a refused sign-in, counting down to the pause. */
export function wrongCredentials(failures: number): string {
  const left = Math.max(0, LOGIN_MAX_ATTEMPTS - failures);
  return `The email or password is incorrect. ${left} ${left === 1 ? 'attempt' : 'attempts'} left before sign-in is paused.`;
}

/** The label on the disabled button while sign-in is paused: `Try again in 0:42`. */
export function lockLabel(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `Try again in ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The line at the bottom of the bell popover (deck src 3482; staff have the bell too, D11). */
export function bellFooter(role: AccountRole): string {
  return role === 'staff' ? 'Also sent to your work email' : 'Also sent to your school email';
}
