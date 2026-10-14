import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** The one create action of the current page ("Record violation"): a header pill on desktop, a floating button on a phone. */
export interface PageActionSpec {
  label: string;
  icon: string;
  onClick: () => void;
}

interface PageActionValue {
  action: PageActionSpec | null;
  setAction: (action: PageActionSpec | null) => void;
}

const PageActionContext = createContext<PageActionValue>({ action: null, setAction: () => undefined });

export function PageActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<PageActionSpec | null>(null);
  const value = useMemo(() => ({ action, setAction }), [action]);
  return <PageActionContext.Provider value={value}>{children}</PageActionContext.Provider>;
}

/** What the shell shows for the current page, or null. */
export function usePageActionValue(): PageActionSpec | null {
  return useContext(PageActionContext).action;
}

/** A page registers its create action while it is mounted; the latest `onClick` is always the one that runs. */
export function usePageAction(label: string, icon: string, onClick: () => void): void {
  const { setAction } = useContext(PageActionContext);
  const latest = useRef(onClick);
  latest.current = onClick;
  useEffect(() => {
    setAction({ label, icon, onClick: () => latest.current() });
    return () => setAction(null);
  }, [label, icon, setAction]);
}
