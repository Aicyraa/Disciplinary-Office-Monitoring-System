import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Card, EmptyState, Icon, PageHeader, Resource, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { formatDate, formatTerm } from '../lib/format';
import { useApi } from '../lib/useApi';

function Stat({ label, value, to }: { label: string; value: number | string; to: string }) {
  return (
    <Link to={to} className="rounded-lg border border-line bg-white p-4 hover:border-primary">
      <div className="text-2xl font-bold text-ink">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </Link>
  );
}

export function StudentDashboard() {
  const { state } = useAuth();
  const name = state.status === 'authenticated' ? state.user.firstName : '';
  const cases = useApi(() => api.myCases(), []);
  const sanctions = useApi(() => api.mySanctions(), []);
  const appointments = useApi(() => api.myAppointments(), []);
  const clearance = useApi(() => api.myClearance(), []);

  return (
    <>
      <PageHeader title={`Welcome, ${name}`} subtitle="A summary of your records with the Student Discipline Office." />
      <div className="grid grid-cols-2 gap-3 full:grid-cols-4">
        <Resource resource={cases}>
          {({ cases: list }) => (
            <Stat label="Open violations" value={list.filter((c) => c.status !== 'resolved' && c.status !== 'rejected').length} to="/violations" />
          )}
        </Resource>
        <Resource resource={sanctions}>
          {({ sanctions: list }) => (
            <Stat label="Sanctions to complete" value={list.filter((s) => s.status !== 'completed').length} to="/sanctions" />
          )}
        </Resource>
        <Resource resource={appointments}>
          {({ appointments: list }) => (
            <Stat label="Upcoming appointments" value={list.filter((a) => a.bucket === 'upcoming').length} to="/appointments" />
          )}
        </Resource>
        <Resource resource={clearance}>
          {({ clearance: current }) => (
            <Stat label="Clearance" value={current ? (current.status === 'cleared' ? 'Cleared' : 'Pending') : 'None yet'} to="/clearance" />
          )}
        </Resource>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold text-ink">Next steps</h2>
      <Resource resource={sanctions}>
        {({ sanctions: list }) => {
          const open = list.filter((s) => s.status !== 'completed');
          if (open.length === 0) return <EmptyState title="Nothing is waiting on you." hint="New sanctions will appear here." />;
          return (
            <ul className="space-y-2">
              {open.slice(0, 5).map((sanction) => (
                <li key={sanction.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white p-3">
                  <div>
                    <div className="font-medium text-ink">{sanction.type}</div>
                    <div className="text-sm text-muted">
                      {sanction.caseCode} · due {formatDate(sanction.dueDate)}
                    </div>
                  </div>
                  <StatusPill status={sanction.status} />
                </li>
              ))}
            </ul>
          );
        }}
      </Resource>
      <Resource resource={clearance}>
        {({ clearance: current }) =>
          current ? (
            <p className="mt-6 text-sm text-muted">
              <Icon name="verified_user" className="mr-1 align-middle text-base" />
              Clearance for {formatTerm(current.academicYear, current.semester)} is{' '}
              <strong className="text-ink">{current.status}</strong>.
            </p>
          ) : null
        }
      </Resource>
    </>
  );
}

export function StaffHome() {
  const { state } = useAuth();
  const name = state.status === 'authenticated' ? state.user.firstName : '';
  return (
    <>
      <PageHeader title={`Welcome, ${name}`} subtitle="Staff tools are being added step by step." />
      <Card>
        <p className="text-sm">
          The case, sanction, appointment and clearance screens for staff are built in later steps. The{' '}
          <Link to="/handbook" className="font-medium text-primary underline">
            handbook
          </Link>{' '}
          is available now.
        </p>
      </Card>
    </>
  );
}
