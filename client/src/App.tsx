import { BrowserRouter, MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import type { AccountRole } from '@shared/types';
import { AuthProvider, useAuth, type AuthState } from './auth/AuthContext';
import { Shell } from './components/Shell';
import { LoadingState } from './components/ui';
import { ToastProvider } from './components/feedback';
import { AccountDetailsPage } from './pages/AccountDetails';
import { AppointmentsPage } from './pages/Appointments';
import ChangePassword from './pages/ChangePassword';
import { ClearancePage } from './pages/Clearance';
import { StaffHome, StudentDashboard } from './pages/Dashboard';
import { HandbookPage } from './pages/Handbook';
import GateReportPage from './pages/GateReport';
import Login from './pages/Login';
import { InboxPage } from './pages/Inbox';
import { NoAccessPage, NotFoundPage } from './pages/Misc';
import { RecordViolationPage } from './pages/RecordViolation';
import { StaffClearancePage } from './pages/StaffClearance';
import { StudentsPage } from './pages/Students';
import { MakeAppointmentPage, StaffAppointmentsPage } from './pages/StaffAppointments';
import { CaseDetailPage } from './pages/StaffCaseDetail';
import { CasesPage } from './pages/StaffCases';
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

/** Pages for one role only (the `/me/*` API is 403 for staff, the case API is 403 for students). */
function RoleOnly({ role }: { role: AccountRole }) {
  const { state } = useAuth();
  if (state.status === 'authenticated' && state.user.role !== role) return <NoAccessPage />;
  return <Outlet />;
}

function Home() {
  const { state } = useAuth();
  return state.status === 'authenticated' && state.user.role === 'staff' ? <StaffHome /> : <StudentDashboard />;
}

/** One address, two screens: students see their own appointments, staff manage everyone's. */
function AppointmentsRoute() {
  const { state } = useAuth();
  return state.status === 'authenticated' && state.user.role === 'staff' ? <StaffAppointmentsPage /> : <AppointmentsPage />;
}

/** One address, two screens: a student reads their own checklist, staff set up and mark everyone's. */
function ClearanceRoute() {
  const { state } = useAuth();
  return state.status === 'authenticated' && state.user.role === 'staff' ? <StaffClearancePage /> : <ClearancePage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* The public gate form: no sign-in, outside the signed-in shell (SPEC 4.10). */}
      <Route path="/report" element={<GateReportPage />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<Home />} />
          <Route path="handbook" element={<HandbookPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="account" element={<AccountDetailsPage />} />
          <Route path="account/password" element={<ChangePassword />} />
          <Route path="appointments" element={<AppointmentsRoute />} />
          <Route path="clearance" element={<ClearanceRoute />} />
          <Route element={<RoleOnly role="student" />}>
            <Route path="violations" element={<ViolationsList />} />
            <Route path="violations/:id" element={<ViolationDetail />} />
            <Route path="sanctions" element={<SanctionsPage />} />
          </Route>
          <Route element={<RoleOnly role="staff" />}>
            <Route path="record" element={<RecordViolationPage />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="cases/:id" element={<CaseDetailPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="students/:id" element={<StudentsPage />} />
            <Route path="appointments/new" element={<MakeAppointmentPage />} />
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
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
