import type { CaseStore } from '../cases/types.js';

/**
 * Wraps a store so that `onCommit` runs after a transaction that finished without throwing. This is the
 * "commit first, notify second" rule (POWER-AUTOMATE.md section 2): notification rows are written inside the
 * transaction, and only once it has committed is a delivery pass asked for. `onCommit` must not throw; the
 * scheduler's `kick` never does. If the transaction rolls back, nothing is delivered.
 */
export function withAfterCommit(store: CaseStore, onCommit: () => void): CaseStore {
  return {
    async transaction(work) {
      const result = await store.transaction(work);
      onCommit();
      return result;
    },
  };
}
