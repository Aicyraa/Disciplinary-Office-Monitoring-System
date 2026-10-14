/** Sign-in and password checks that run before the API is called. The API stays the authority (SPEC 4.8). */

/** `@nu-fairview.edu.ph` (staff) or `@students.nu-fairview.edu.ph` (students). */
const NU_EMAIL_DOMAIN = /@(students\.)?nu-fairview\.edu\.ph$/;

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
  if (address !== '' && !NU_EMAIL_DOMAIN.test(address)) return 'Use your NU email (ending in nu-fairview.edu.ph).';
  if (address === '' || password === '') return 'Enter your NU email and password.';
  return null;
}

export interface LoginErrors {
  email?: string;
  password?: string;
}

/** The per-field sign-in messages: empty email, malformed email, not an NU domain, empty password. */
export function loginErrors(email: string, password: string): LoginErrors {
  const errors: LoginErrors = {};
  const address = email.trim().toLowerCase();
  if (address === '') errors.email = 'Enter your NU email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) errors.email = 'Enter a valid email address, like name@students.nu-fairview.edu.ph.';
  else if (!NU_EMAIL_DOMAIN.test(address)) errors.email = 'Use your NU email (@students.nu-fairview.edu.ph or @nu-fairview.edu.ph).';
  if (password === '') errors.password = 'Enter your password.';
  return errors;
}

/** "Set a new password" after a temporary password (deck src 3420). Reuse of the temporary one is the API's check. */
export function forcedPasswordError(next: string, confirm: string): string | null {
  if (!passwordRules(next).every((rule) => rule.ok)) return 'Your new password doesn’t meet the rules below.';
  if (next !== confirm) return 'The passwords don’t match.';
  return null;
}
