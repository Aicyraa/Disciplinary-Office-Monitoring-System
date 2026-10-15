import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/feedback';
import { AppRoutes } from '@/routes/AppRoutes';

/** The shell: router, providers and the route table (`routes/AppRoutes.tsx`). */
export default function App() {
  // Server-side rendering (the smoke test) has no window, so fall back to an in-memory router there.
  const Router = typeof window === 'undefined' ? MemoryRouter : BrowserRouter;
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <Analytics />
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
