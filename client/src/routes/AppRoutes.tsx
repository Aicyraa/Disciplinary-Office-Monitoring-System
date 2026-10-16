import { lazy, Suspense, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { Spinner } from '@/components/feedback/PageState';
import Login from '@/pages/public/Login';
import { NotFoundPage } from '@/pages/shared/Misc';
import { RequireAuth, RequireRole, RoleSwitch } from './guards';

// Route-level code splitting (PERFORMANCE-SPEC F1): every page but the sign-in screen is its own chunk, so a
// visitor opening /login or /report never downloads the staff or student screens. Login stays in the entry
// chunk because it is the first page almost everyone sees.
function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(() => load().then((module) => ({ default: module[name] as ComponentType })));
}

const GateReportPage = lazy(() => import('@/pages/public/GateReport'));
const ChangePassword = lazy(() => import('@/pages/account/ChangePassword'));
const StaffHome = page(() => import('@/pages/staff/Dashboard'), 'StaffHome');
const StudentDashboard = page(() => import('@/pages/student/Dashboard'), 'StudentDashboard');
const StudentHandbookPage = page(() => import('@/pages/student/Handbook'), 'StudentHandbookPage');
const StaffViolationsPage = page(() => import('@/pages/staff/Violations'), 'StaffViolationsPage');
const AppointmentsPage = page(() => import('@/pages/student/Appointments'), 'AppointmentsPage');
const StaffAppointmentsPage = page(() => import('@/pages/staff/Appointments'), 'StaffAppointmentsPage');
const ClearancePage = page(() => import('@/pages/student/Clearance'), 'ClearancePage');
const StaffClearancePage = page(() => import('@/pages/staff/Clearance'), 'StaffClearancePage');
const InboxPage = page(() => import('@/pages/shared/Inbox'), 'InboxPage');
const ViolationsPage = page(() => import('@/pages/student/Violations'), 'ViolationsPage');
const SanctionsPage = page(() => import('@/pages/student/Sanctions'), 'SanctionsPage');
const CasesPage = page(() => import('@/pages/staff/Cases'), 'CasesPage');
const NoticesPage = page(() => import('@/pages/staff/Notices'), 'NoticesPage');
const StudentsPage = page(() => import('@/pages/staff/Students'), 'StudentsPage');
const SanctionTemplatesPage = page(() => import('@/pages/staff/SanctionTemplates'), 'SanctionTemplatesPage');

const home = <RoleSwitch staff={<StaffHome />} student={<StudentDashboard />} />;
// Staff edit the handbook ("Violations"); students read it.
const handbook = <RoleSwitch staff={<StaffViolationsPage />} student={<StudentHandbookPage />} />;
// Students see their own appointments, staff manage everyone's.
const appointments = <RoleSwitch staff={<StaffAppointmentsPage />} student={<AppointmentsPage />} />;
// A student reads their own checklist, staff set up and mark everyone's.
const clearance = <RoleSwitch staff={<StaffClearancePage />} student={<ClearancePage />} />;

/** While a public page's chunk loads (signed-in pages show the Shell's own loading state instead). */
function PublicPageLoading() {
  return (
    <p role="status" className="flex min-h-screen items-center justify-center gap-2 text-[13px] text-muted">
      <Spinner />
      Loading…
    </p>
  );
}

/** The whole route table: public pages, then everything behind sign-in inside the Shell. */
export function AppRoutes() {
  return (
    <Suspense fallback={<PublicPageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* The public gate form: no sign-in, outside the signed-in shell (SPEC 4.10). */}
        <Route path="/report" element={<GateReportPage />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route element={<RequireAuth />}>
          <Route element={<Shell />}>
            <Route index element={home} />
            <Route path="handbook" element={handbook} />
            <Route path="handbook/:id" element={handbook} />
            <Route path="inbox" element={<InboxPage />} />
            {/* Account details and Change password are dialogs (UI-POLISH-SPEC 5.10); the old addresses open them. */}
            <Route path="account" element={<Navigate to="/" replace state={{ account: 'details' }} />} />
            <Route path="account/password" element={<Navigate to="/" replace state={{ account: 'password' }} />} />
            <Route path="appointments" element={appointments} />
            <Route path="appointments/:id" element={appointments} />
            <Route path="clearance" element={clearance} />
            <Route path="clearance/:id" element={clearance} />
            <Route element={<RequireRole role="student" />}>
              <Route path="violations" element={<ViolationsPage />} />
              <Route path="violations/:id" element={<ViolationsPage />} />
              <Route path="sanctions" element={<SanctionsPage />} />
              <Route path="sanctions/:id" element={<SanctionsPage />} />
            </Route>
            <Route element={<RequireRole role="staff" />}>
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
    </Suspense>
  );
}
