import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '@shared/types';
import { api, ApiError, setSessionEndedHandler } from '../lib/api';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthUser };

interface AuthContextValue {
  state: AuthState;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  /** Replace the signed-in user, for example after a forced password change. */
  setUser(user: AuthUser): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  // Restore the session from the cookie. A 401 simply means "not signed in".
  useEffect(() => {
    let cancelled = false;
    api.me().then(
      ({ user }) => {
        if (!cancelled) setState({ status: 'authenticated', user });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status !== 401) console.error(error);
        setState({ status: 'anonymous' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // A 401 on any data request means the session ended; drop to the login screen instead of showing errors.
  useEffect(() => {
    setSessionEndedHandler(() => setState((current) => (current.status === 'authenticated' ? { status: 'anonymous' } : current)));
    return () => setSessionEndedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user } = await api.login(email, password);
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState({ status: 'anonymous' });
    }
  }, []);

  const setUser = useCallback((user: AuthUser) => setState({ status: 'authenticated', user }), []);

  const value = useMemo(() => ({ state, signIn, signOut, setUser }), [state, signIn, signOut, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
