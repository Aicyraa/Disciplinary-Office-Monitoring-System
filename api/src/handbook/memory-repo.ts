import type { HandbookEntryRecord, HandbookRepo } from './repo.js';

/** In-memory fake for tests. */
export function createMemoryHandbookRepo(entries: HandbookEntryRecord[] = []): HandbookRepo {
  return {
    async listEntries() {
      return entries.map((entry) => ({ ...entry }));
    },
    async getEntry(handbookEntryId) {
      const entry = entries.find((candidate) => candidate.handbookEntryId === handbookEntryId);
      return entry ? { ...entry } : null;
    },
  };
}
