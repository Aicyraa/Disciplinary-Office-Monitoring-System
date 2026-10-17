import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/components/feedback';
import { OfflineBanner, OfflineScreen } from '@/components/feedback/Offline';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { AppRoutes } from '@/routes/AppRoutes';

/**
 * Opened with no connection, nothing can load: the connection screen replaces the routes and retries on its own
 * once the browser is back online. A drop mid-use only adds the banner over what is already on screen.
 */
function ConnectionGate({ children }: { children: ReactNode }) {
  const { state, retry } = useAuth();
  const online = useOnlineStatus();
  const offline = state.status === 'offline';

  // Retry on the "back online" event only: an unreachable server while online must not loop.
  useEffect(() => {
    if (!offline) return;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [offline, retry]);

  if (offline) return <OfflineScreen online={online} onRetry={retry} />;
  return (
    <>
      {online ? null : <OfflineBanner />}
      {children}
    </>
  );
}

/** The shell: router, providers and the route table (`routes/AppRoutes.tsx`). */
export default function App() {
  // Server-side rendering (the smoke test) has no window, so fall back to an in-memory router there.
  const Router = typeof window === 'undefined' ? MemoryRouter : BrowserRouter;
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <ConnectionGate>
            <AppRoutes />
          </ConnectionGate>
          <Analytics />
          <SpeedInsights />
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
