import type { AccountRole } from '@shared/types.js';
import type { AccountRecord, AccountRepo } from './repo.js';

export interface MemoryAccountRepo extends AccountRepo {
  readonly accounts: Map<string, AccountRecord>;
}

const keyOf = (role: AccountRole, id: string) => `${role}:${id}`;

/** In-memory fake for tests; never touches a database. */
export function createMemoryAccountRepo(seed: Array<AccountRecord & { role: AccountRole }> = []): MemoryAccountRepo {
  const accounts = new Map<string, AccountRecord>();
  for (const { role, ...record } of seed) accounts.set(keyOf(role, record.id), record);

  return {
    accounts,
    async findByEmail(role, email) {
      for (const [key, record] of accounts) {
        if (key.startsWith(`${role}:`) && record.email.toLowerCase() === email.toLowerCase()) return { ...record };
      }
      return null;
    },
    async findById(role, id) {
      const record = accounts.get(keyOf(role, id));
      return record ? { ...record } : null;
    },
    async updatePassword(role, id, passwordHashed, mustChangePassword) {
      const record = accounts.get(keyOf(role, id));
      if (!record) return false;
      accounts.set(keyOf(role, id), { ...record, passwordHashed, mustChangePassword });
      return true;
    },
  };
}
