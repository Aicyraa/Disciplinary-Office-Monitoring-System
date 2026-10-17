import type { ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import type { AccountRole } from '@shared/types';
import { useAuth, type AuthState } from '@/context/AuthContext';
import { Spinner } from '@/components/feedback/PageState';
import { NoAccessPage } from '@/pages/shared/Misc';

export type Access = 'loading' | 'login' | 'change-password' | 'allow';

/** What a protected route should do for the current session. Pure, so it is testable without a DOM. */
export function resolveAccess(state: AuthState): Access {
  // Offline never reaches the routes (App shows the connection screen instead); wait like a slow probe.
  if (state.status === 'loading' || state.status === 'offline') return 'loading';
  if (state.status === 'anonymous') return 'login';
  return state.user.mustChangePassword ? 'change-password' : 'allow';
}

/** Signed in with a settled password, or sent to /login or /change-password. */
export function RequireAuth() {
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
export function RequireRole({ role }: { role: AccountRole }) {
  const { state } = useAuth();
  if (state.status === 'authenticated' && state.user.role !== role) return <NoAccessPage />;
  return <Outlet />;
}

/** One address, two screens: staff get `staff`, everyone else (students) gets `student`. */
export function RoleSwitch({ staff, student }: { staff: ReactNode; student: ReactNode }) {
  const { state } = useAuth();
  return state.status === 'authenticated' && state.user.role === 'staff' ? staff : student;
}
