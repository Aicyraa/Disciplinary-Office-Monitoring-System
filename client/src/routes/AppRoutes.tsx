import { Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from '@/components/layout/Shell';
import { AppointmentsPage } from '@/pages/student/Appointments';
import ChangePassword from '@/pages/account/ChangePassword';
import { ClearancePage } from '@/pages/student/Clearance';
import { StaffHome } from '@/pages/staff/Dashboard';
import { StudentDashboard } from '@/pages/student/Dashboard';
import { StudentHandbookPage } from '@/pages/student/Handbook';
import { SanctionTemplatesPage } from '@/pages/staff/SanctionTemplates';
import { StaffViolationsPage } from '@/pages/staff/Violations';
import GateReportPage from '@/pages/public/GateReport';
import Login from '@/pages/public/Login';
import { InboxPage } from '@/pages/shared/Inbox';
import { NotFoundPage } from '@/pages/shared/Misc';
import { StaffClearancePage } from '@/pages/staff/Clearance';
import { NoticesPage } from '@/pages/staff/Notices';
import { StudentsPage } from '@/pages/staff/Students';
import { StaffAppointmentsPage } from '@/pages/staff/Appointments';
import { CasesPage } from '@/pages/staff/Cases';
import { SanctionsPage } from '@/pages/student/Sanctions';
import { ViolationsPage } from '@/pages/student/Violations';
import { RequireAuth, RequireRole, RoleSwitch } from './guards';

const home = <RoleSwitch staff={<StaffHome />} student={<StudentDashboard />} />;
// Staff edit the handbook ("Violations"); students read it.
const handbook = <RoleSwitch staff={<StaffViolationsPage />} student={<StudentHandbookPage />} />;
// Students see their own appointments, staff manage everyone's.
const appointments = <RoleSwitch staff={<StaffAppointmentsPage />} student={<AppointmentsPage />} />;
// A student reads their own checklist, staff set up and mark everyone's.
const clearance = <RoleSwitch staff={<StaffClearancePage />} student={<ClearancePage />} />;

/** The whole route table: public pages, then everything behind sign-in inside the Shell. */
export function AppRoutes() {
  return (
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
  );
}
