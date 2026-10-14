import { BrowserRouter, MemoryRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import type { AccountRole } from '@shared/types';
import { AuthProvider, useAuth, type AuthState } from '@/context/AuthContext';
import { Shell } from '@/components/layout/Shell';
import { Spinner } from '@/components/feedback/PageState';
import { ToastProvider } from '@/components/feedback';
import { AppointmentsPage } from '@/pages/student/Appointments';
import ChangePassword from '@/pages/account/ChangePassword';
import { ClearancePage, ClearanceSlipPage } from '@/pages/student/Clearance';
import { StaffHome } from '@/pages/staff/Dashboard';
import { StudentDashboard } from '@/pages/student/Dashboard';
import { StudentHandbookPage } from '@/pages/student/Handbook';
import { SanctionTemplatesPage } from '@/pages/staff/SanctionTemplates';
import { StaffViolationsPage } from '@/pages/staff/Violations';
import GateReportPage from '@/pages/public/GateReport';
import Login from '@/pages/public/Login';
import { InboxPage } from '@/pages/shared/Inbox';
import { NoAccessPage, NotFoundPage } from '@/pages/shared/Misc';
import { StaffClearancePage } from '@/pages/staff/Clearance';
import { NoticesPage } from '@/pages/staff/Notices';
import { StudentsPage } from '@/pages/staff/Students';
import { StaffAppointmentsPage } from '@/pages/staff/Appointments';
import { CasesPage } from '@/pages/staff/Cases';
import { SanctionsPage } from '@/pages/student/Sanctions';
import { ViolationsPage } from '@/pages/student/Violations';

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
        <p role="status" className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted">
          <Spinner />
          Checking your session…
        </p>
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

/** Staff edit the handbook ("Violations"); students read it. */
function HandbookRoute() {
  const { state } = useAuth();
  return state.status === 'authenticated' && state.user.role === 'staff' ? <StaffViolationsPage /> : <StudentHandbookPage />;
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
          <Route path="handbook" element={<HandbookRoute />} />
          <Route path="handbook/:id" element={<HandbookRoute />} />
          <Route path="inbox" element={<InboxPage />} />
          {/* Account details and Change password are dialogs (UI-POLISH-SPEC 5.10); the old addresses open them. */}
          <Route path="account" element={<Navigate to="/" replace state={{ account: 'details' }} />} />
          <Route path="account/password" element={<Navigate to="/" replace state={{ account: 'password' }} />} />
          <Route path="appointments" element={<AppointmentsRoute />} />
          <Route path="appointments/:id" element={<AppointmentsRoute />} />
          <Route path="clearance" element={<ClearanceRoute />} />
          <Route path="clearance/:id" element={<ClearanceRoute />} />
          <Route element={<RoleOnly role="student" />}>
            <Route path="violations" element={<ViolationsPage />} />
            <Route path="violations/:id" element={<ViolationsPage />} />
            <Route path="sanctions" element={<SanctionsPage />} />
            <Route path="sanctions/:id" element={<SanctionsPage />} />
            <Route path="clearance/slip" element={<ClearanceSlipPage />} />
          </Route>
          <Route element={<RoleOnly role="staff" />}>
            <Route path="cases" element={<CasesPage />} />
            <Route path="cases/:id" element={<CasesPage />} />
            <Route path="notices" element={<NoticesPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="students/:id" element={<StudentsPage />} />
            <Route path="sanction-templates" element={<SanctionTemplatesPage />} />
            <Route path="sanction-templates/:id" element={<SanctionTemplatesPage />} />
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
