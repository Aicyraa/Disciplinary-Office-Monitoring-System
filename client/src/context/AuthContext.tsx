import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '@shared/types';
import { ApiError, setSessionEndedHandler } from '@/api/client';
import { authApi } from '@/api/auth';

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  /** The session probe got no response at all (no internet, or the server is unreachable). */
  | { status: 'offline' }
  | { status: 'authenticated'; user: AuthUser };

interface AuthContextValue {
  state: AuthState;
  /** Probes the session again, for example after the connection comes back. */
  retry(): void;
  signIn(email: string, password: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  /** Replace the signed-in user, for example after a forced password change. */
  setUser(user: AuthUser): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  // Restore the session from the cookie. A 401 simply means "not signed in"; no response at all means offline.
  useEffect(() => {
    let cancelled = false;
    authApi.me().then(
      ({ user }) => {
        if (!cancelled) setState({ status: 'authenticated', user });
      },
      (error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 0) {
          setState({ status: 'offline' });
          return;
        }
        if (error instanceof ApiError && error.status !== 401) console.error(error);
        setState({ status: 'anonymous' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  // A 401 on any data request means the session ended; drop to the login screen instead of showing errors.
  useEffect(() => {
    setSessionEndedHandler(() => setState((current) => (current.status === 'authenticated' ? { status: 'anonymous' } : current)));
    return () => setSessionEndedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { user } = await authApi.login(email, password);
    setState({ status: 'authenticated', user });
    return user;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setState({ status: 'anonymous' });
    }
  }, []);

  const setUser = useCallback((user: AuthUser) => setState({ status: 'authenticated', user }), []);

  const value = useMemo(() => ({ state, retry, signIn, signOut, setUser }), [state, retry, signIn, signOut, setUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
