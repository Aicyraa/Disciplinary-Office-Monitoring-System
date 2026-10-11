import { BrowserRouter, MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import type { AccountRole } from '../../shared/types';
import { AuthProvider, useAuth, type AuthState } from './auth/AuthContext';
import { Shell } from './components/Shell';
import { LoadingState } from './components/ui';
import { AppointmentsPage } from './pages/Appointments';
import ChangePassword from './pages/ChangePassword';
import { ClearancePage } from './pages/Clearance';
import { StaffHome, StudentDashboard } from './pages/Dashboard';
import { HandbookPage } from './pages/Handbook';
import Login from './pages/Login';
import { InboxPage, NotFoundPage } from './pages/Misc';
import { SanctionsPage } from './pages/Sanctions';
import { ViolationDetail, ViolationsList } from './pages/Violations';

export type Access = 'loading' | 'login' | 'change-password' | 'allow';

/** What a protected route should do for the current session. Pure, so it is testable without a DOM. */
export function resolveAccess(state: AuthState): Access {
  if (state.status === 'loading') return 'loading';
  if (state.status === 'anonymous') return 'login';
  return state.user.mustChangePassword ? 'change-password' : 'allow';
}

function RequireAuth() {
  const { state } = useAuth();
  const access = resolveAccess(state);
  if (access === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2">
        <p className="font-semibold text-ink">Disciplinary Office Monitoring System</p>
        <LoadingState label="Checking your session…" />
      </div>
    );
  }
  if (access === 'login') return <Navigate to="/login" replace />;
  if (access === 'change-password') return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

/** Students only (the `/me/*` API is 403 for staff). */
function RoleOnly({ role }: { role: AccountRole }) {
  const { state } = useAuth();
  if (state.status === 'authenticated' && state.user.role !== role) return <Navigate to="/" replace />;
  return <Outlet />;
}

function Home() {
  const { state } = useAuth();
  return state.status === 'authenticated' && state.user.role === 'staff' ? <StaffHome /> : <StudentDashboard />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="handbook" element={<HandbookPage />} />
          <Route element={<RoleOnly role="student" />}>
            <Route path="inbox" element={<InboxPage />} />
            <Route path="violations" element={<ViolationsList />} />
            <Route path="violations/:id" element={<ViolationDetail />} />
            <Route path="sanctions" element={<SanctionsPage />} />
            <Route path="appointments" element={<AppointmentsPage />} />
            <Route path="clearance" element={<ClearancePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  // Server-side rendering (the smoke test) has no window, so fall back to an in-memory router there.
  const Router = typeof window === 'undefined' ? MemoryRouter : BrowserRouter;
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
