import type { HandbookEntryRecord, HandbookRepo } from './repo.js';

/** In-memory fake for tests. `cases` is the number of cases per handbook entry id. */
export function createMemoryHandbookRepo(
  entries: HandbookEntryRecord[] = [],
  cases: Record<number, number> = {},
): HandbookRepo {
  return {
    async listEntries() {
      return entries.map((entry) => ({ ...entry }));
    },
    async getEntry(handbookEntryId) {
      const entry = entries.find((candidate) => candidate.handbookEntryId === handbookEntryId);
      return entry ? { ...entry } : null;
    },
    async caseCounts() {
      return new Map(Object.entries(cases).map(([id, count]) => [Number(id), count]));
    },
  };
}
