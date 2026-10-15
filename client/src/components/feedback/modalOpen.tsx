import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface ModalOpenValue {
  count: number;
  register: () => () => void;
}

const ModalOpenContext = createContext<ModalOpenValue>({ count: 0, register: () => () => undefined });

/** Counts the dialogs open right now, so the phone's floating action button can step aside for them. */
export function ModalOpenProvider({ children }: { children: ReactNode }) {
  const [count, setCount] = useState(0);
  const register = useCallback(() => {
    setCount((current) => current + 1);
    return () => setCount((current) => Math.max(0, current - 1));
  }, []);
  const value = useMemo<ModalOpenValue>(() => ({ count, register }), [count, register]);
  return <ModalOpenContext.Provider value={value}>{children}</ModalOpenContext.Provider>;
}

/** True while at least one dialog is open under the provider. */
export function useAnyModalOpen(): boolean {
  return useContext(ModalOpenContext).count > 0;
}

/** Called by every dialog frame: counts it while `open`. */
export function useRegisterModal(open: boolean): void {
  const { register } = useContext(ModalOpenContext);
  useEffect(() => {
    if (!open) return;
    return register();
  }, [open, register]);
}
