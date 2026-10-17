/** A yes/no flag kept for the browser session. Storage can be missing or throw (private windows), so every call is guarded. */
type FlagStore = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): FlagStore | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export function readSessionFlag(key: string, store: FlagStore | null = defaultStore()): boolean {
  try {
    return store?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeSessionFlag(key: string, store: FlagStore | null = defaultStore()): void {
  try {
    store?.setItem(key, '1');
  } catch {
    /* nothing to remember it with: the flag simply does not stick */
  }
}
