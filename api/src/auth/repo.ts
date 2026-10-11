import type { AccountRole } from '../../../shared/types.js';

export interface AccountRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHashed: string;
  mustChangePassword: boolean;
  isActive: boolean;
}

/** Account persistence. Tests use the in-memory implementation; the API uses the Prisma one. */
export interface AccountRepo {
  findByEmail(role: AccountRole, email: string): Promise<AccountRecord | null>;
  findById(role: AccountRole, id: string): Promise<AccountRecord | null>;
  /** Returns false when the account does not exist. */
  updatePassword(role: AccountRole, id: string, passwordHashed: string, mustChangePassword: boolean): Promise<boolean>;
}
