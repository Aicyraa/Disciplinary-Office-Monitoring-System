import bcrypt from 'bcryptjs';
import type { AccountRole, AuthUser } from '@shared/types.js';
import { checkPasswordRules, generateTempPassword, normalizeEmail, roleForEmail } from '../domain/auth/policy.js';
import type { AccountRecord, AccountRepo } from '../repositories/auth/repo.js';

export type ChangePasswordResult =
  | { ok: true; user: AuthUser }
  | { ok: false; code: 'weak_password' | 'wrong_password' | 'same_password' | 'not_found'; message: string };

export type ResetPasswordResult = { ok: true; tempPassword: string } | { ok: false; code: 'not_found' };

export interface AuthService {
  /** Returns the user, or null for any failure (unknown email, wrong password, bad domain, inactive). */
  login(email: string, password: string): Promise<AuthUser | null>;
  getUser(role: AccountRole, id: string): Promise<AuthUser | null>;
  changePassword(role: AccountRole, id: string, currentPassword: string, newPassword: string): Promise<ChangePasswordResult>;
  /** Staff reset of a student account: new one-time Temp-####, forced change at next sign-in. */
  resetStudentPassword(studentId: string): Promise<ResetPasswordResult>;
}

export interface AuthServiceOptions {
  repo: AccountRepo;
  /** bcrypt cost; tests lower it. */
  rounds?: number;
  generateTemp?: () => string;
}

const toUser = (role: AccountRole, record: AccountRecord): AuthUser => ({
  role,
  id: record.id,
  email: record.email,
  firstName: record.firstName,
  lastName: record.lastName,
  mustChangePassword: record.mustChangePassword,
});

export function createAuthService({ repo, rounds = 12, generateTemp = generateTempPassword }: AuthServiceOptions): AuthService {
  // Compared against when the account is missing, so a miss costs about the same as a hit.
  let dummyHash: Promise<string> | undefined;
  const getDummyHash = () => (dummyHash ??= bcrypt.hash('not-a-real-password-1', rounds));

  return {
    async login(email, password) {
      // The address must be an NU address (SPEC 4.8). The role is the table the account lives in: the address's
      // own domain is tried first, then the other table, so a staff account may use a student address (the
      // demo accounts do). Accounts are added by hand, so the two tables never hold the same address.
      const domainRole = roleForEmail(email);
      let role: AccountRole | null = null;
      let record: AccountRecord | null = null;
      if (domainRole) {
        const order: AccountRole[] = domainRole === 'student' ? ['student', 'staff'] : ['staff', 'student'];
        for (const candidate of order) {
          const found = await repo.findByEmail(candidate, normalizeEmail(email));
          if (found) {
            role = candidate;
            record = found;
            break;
          }
        }
      }
      const matches = await bcrypt.compare(password, record?.passwordHashed ?? (await getDummyHash()));
      if (!role || !record || !record.isActive || !matches) return null;
      return toUser(role, record);
    },

    async getUser(role, id) {
      const record = await repo.findById(role, id);
      return record && record.isActive ? toUser(role, record) : null;
    },

    async changePassword(role, id, currentPassword, newPassword) {
      const record = await repo.findById(role, id);
      if (!record || !record.isActive) return { ok: false, code: 'not_found', message: 'Account not found.' };
      if (!(await bcrypt.compare(currentPassword, record.passwordHashed))) {
        return { ok: false, code: 'wrong_password', message: 'Current password is incorrect.' };
      }
      const ruleError = checkPasswordRules(newPassword);
      if (ruleError) return { ok: false, code: 'weak_password', message: ruleError };
      // Covers "cannot equal the temp password": the current password is the temp one after a reset.
      if (newPassword === currentPassword) {
        return { ok: false, code: 'same_password', message: 'New password must be different from the current one.' };
      }
      await repo.updatePassword(role, id, await bcrypt.hash(newPassword, rounds), false);
      return { ok: true, user: toUser(role, { ...record, mustChangePassword: false }) };
    },

    async resetStudentPassword(studentId) {
      const record = await repo.findById('student', studentId);
      if (!record) return { ok: false, code: 'not_found' };
      const tempPassword = generateTemp();
      await repo.updatePassword('student', studentId, await bcrypt.hash(tempPassword, rounds), true);
      return { ok: true, tempPassword };
    },
  };
}
