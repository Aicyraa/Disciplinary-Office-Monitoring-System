import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ACTION_PILL, DashboardCard, DateTile, Kpi, ProgressBar, RowItem } from '../components/DashboardCards';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { activeCases, caseCounts, clearanceProgress, nextAppointment, sanctionCounts } from '../lib/dashboard';
import { formatDate, formatTerm } from '../lib/format';
import { useApi, type ApiResource } from '../lib/useApi';

/** The body of a card whose data may still be loading or have failed. */
function Body<T>({ resource, children }: { resource: ApiResource<T> & { reload(): void }; children: (data: T) => React.ReactNode }) {
  if (resource.status === 'loading') return <LoadingState label="Loading…" />;
  if (resource.status === 'error') return <ErrorState message={resource.error.message} onRetry={resource.reload} />;
  return <>{children(resource.data)}</>;
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
      <div className="grid gap-4 full:grid-cols-[3fr_2fr]">
        <DashboardCard
          icon="gavel"
          tone="danger"
          title="Active violations"
          to="/violations"
          className="full:row-span-2"
        >
          <Body resource={cases}>
            {({ cases: list }) => {
              const counts = caseCounts(list);
              const rows = activeCases(list).slice(0, 5);
              return (
                <>
                  <p className="-mt-3 mb-3 text-xs text-muted">
                    {counts.minor} minor · {counts.major} major
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <Kpi value={counts.pendingReview} label="Pending review" />
                    <Kpi value={counts.validated} label="Validated" />
                    <Kpi value={counts.sanctioned} label="Sanction in progress" />
                  </div>
                  {rows.length === 0 ? (
                    <div className="mt-4">
                      <EmptyState title="You have no active violations." />
                    </div>
                  ) : (
                    <ul className="mt-4">
                      {rows.map((c) => (
                        <RowItem
                          key={c.id}
                          title={c.violation}
                          meta={`${c.code} · ${c.severity} · ${formatDate(c.caseDate)}`}
                          right={<StatusPill status={c.status} kind="case" />}
                        />
                      ))}
                    </ul>
                  )}
                </>
              );
            }}
          </Body>
        </DashboardCard>

        <DashboardCard icon="event" title="Next appointment" to="/appointments">
          <Body resource={appointments}>
            {({ appointments: list }) => {
              const next = nextAppointment(list);
              const upcoming = list.filter((a) => a.bucket === 'upcoming').length;
              const completed = list.filter((a) => a.status === 'completed').length;
              const cancelled = list.filter((a) => a.status === 'cancelled').length;
              return (
                <>
                  {next ? (
                    <div className="flex items-center gap-3 rounded-lg bg-page p-3">
                      <DateTile date={next.startDate} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-ink">
                          {formatDate(next.startDate)} to {formatDate(next.endDate)}
                        </div>
                        <div className="truncate text-xs text-muted">{next.purpose}</div>
                        <div className="text-xs text-muted">Visit any day, Mon to Sat, 7:00 AM to 5:00 PM</div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">No appointment is scheduled for you.</p>
                  )}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <Kpi value={upcoming} label="Upcoming" />
                    <Kpi value={completed} label="Completed" />
                    <Kpi value={cancelled} label="Cancelled" />
                  </div>
                </>
              );
            }}
          </Body>
        </DashboardCard>

        <DashboardCard icon="assignment" tone="gold" title="Active sanctions" to="/sanctions">
          <Body resource={sanctions}>
            {({ sanctions: list }) => {
              const counts = sanctionCounts(list);
              const open = list.filter((s) => s.status !== 'completed').slice(0, 3);
              return (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <Kpi value={counts.inProgress} label="In progress" />
                    <Kpi value={counts.pendingVerification} label="Pending verification" />
                    <Kpi value={counts.cleared} label="Cleared" tone="success" />
                  </div>
                  {open.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">Nothing is waiting on you.</p>
                  ) : (
                    <ul className="mt-3">
                      {open.map((s) => (
                        <RowItem
                          key={s.id}
                          title={s.type}
                          meta={`${s.sanctionCode} · due ${formatDate(s.dueDate)}`}
                          right={<StatusPill status={s.status} kind="sanction" />}
                        />
                      ))}
                    </ul>
                  )}
                </>
              );
            }}
          </Body>
        </DashboardCard>

        <DashboardCard icon="verified_user" tone="success" title="Clearance" to="/clearance" action="View progress" className="full:col-span-2">
          <Body resource={clearance}>
            {({ clearance: current }) => {
              if (!current) return <p className="text-sm text-muted">No clearance has been set up for you yet.</p>;
              const progress = clearanceProgress(current);
              return (
                <>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="text-sm text-muted">{formatTerm(current.academicYear, current.semester)}</span>
                    <span className="text-lg font-bold text-ink">
                      {progress.done}/{progress.total}
                      <span className="ml-1 text-xs font-normal text-muted">requirements done</span>
                    </span>
                  </div>
                  <ProgressBar percent={progress.percent} label="Clearance progress" />
                </>
              );
            }}
          </Body>
        </DashboardCard>
      </div>
    </>
  );
}

export function StaffHome() {
  const { state } = useAuth();
  const name = state.status === 'authenticated' ? state.user.firstName : '';
  const reported = useApi(() => api.staffCases({ status: 'reported', sort: 'oldest' }), []);
  const validated = useApi(() => api.staffCases({ status: 'validated', sort: 'oldest' }), []);
  const sanctioned = useApi(() => api.staffCases({ status: 'for_sanction', sort: 'oldest' }), []);
  const appointments = useApi(() => api.staffAppointments({ bucket: 'upcoming' }), []);
  const clearances = useApi(() => api.staffClearances({ status: 'pending' }), []);

  return (
    <>
      <PageHeader title={`Welcome, ${name}`} subtitle="What needs the office's attention today." />
      <div className="grid gap-4 full:grid-cols-2">
        <DashboardCard icon="flag" tone="danger" title="Reports to validate" to="/cases" className="full:row-span-2">
          <Body resource={reported}>
            {({ cases, total }) => (
              <>
                <div className="grid grid-cols-3 gap-2">
                  <Kpi value={total} label="Reports to validate" tone={total > 0 ? 'danger' : undefined} />
                  <Kpi value={validated.status === 'ready' ? validated.data.total : '–'} label="Awaiting decision" />
                  <Kpi value={sanctioned.status === 'ready' ? sanctioned.data.total : '–'} label="With sanctions" />
                </div>
                {cases.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState title="No report is waiting for validation." />
                  </div>
                ) : (
                  <ul className="mt-4">
                    {cases.slice(0, 4).map((row) => (
                      <RowItem
                        key={row.id}
                        title={row.student?.name ?? row.claimed?.name ?? 'Unknown student'}
                        meta={`${row.code} · ${row.violation}${row.student ? '' : ' · No matching record'}`}
                        right={
                          <Link
                            to={`/cases/${row.id}`}
                            className={ACTION_PILL}
                            aria-label={`Validate ${row.code}`}
                          >
                            Validate
                          </Link>
                        }
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </Body>
        </DashboardCard>

        <DashboardCard icon="gavel" tone="gold" title="Awaiting decision" subtitle="Validated cases with no sanction yet" to="/cases">
          <Body resource={validated}>
            {({ cases, total }) =>
              cases.length === 0 ? (
                <p className="text-sm text-muted">No case is waiting for a decision.</p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted">{total} to decide</p>
                  <ul>
                    {cases.slice(0, 3).map((row) => (
                      <RowItem
                        key={row.id}
                        title={row.student?.name ?? 'Unknown student'}
                        meta={`${row.code} · ${row.violation}`}
                        right={
                          <Link
                            to={`/cases/${row.id}`}
                            className={ACTION_PILL}
                            aria-label={`Decide ${row.code}`}
                          >
                            Decide
                          </Link>
                        }
                      />
                    ))}
                  </ul>
                </>
              )
            }
          </Body>
        </DashboardCard>

        <DashboardCard icon="event" title="Upcoming appointments" to="/appointments">
          <Body resource={appointments}>
            {({ appointments: list, total }) =>
              list.length === 0 ? (
                <p className="text-sm text-muted">No appointment is scheduled.</p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted">{total} upcoming</p>
                  <ul>
                    {list.slice(0, 3).map((a) => (
                      <RowItem
                        key={a.id}
                        title={a.student.name}
                        meta={`${formatDate(a.startDate)} to ${formatDate(a.endDate)} · ${a.purpose}`}
                        right={<StatusPill status={a.status} kind="appointment" />}
                      />
                    ))}
                  </ul>
                </>
              )
            }
          </Body>
        </DashboardCard>

        <DashboardCard icon="verified_user" tone="success" title="Clearance work" subtitle="Terms not yet cleared" to="/clearance" className="full:col-span-2">
          <Body resource={clearances}>
            {({ clearances: list, total }) =>
              list.length === 0 ? (
                <p className="text-sm text-muted">No clearance is waiting.</p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-muted">{total} not yet cleared</p>
                  <ul>
                    {list.slice(0, 3).map((c) => {
                      const done = c.items.filter((item) => item.status === 'completed').length;
                      return (
                        <RowItem
                          key={c.id}
                          title={c.student.name}
                          meta={`${formatTerm(c.academicYear, c.semester)} · ${done} of ${c.items.length} requirements done`}
                          right={<StatusPill status={c.status} kind="clearance" />}
                        />
                      );
                    })}
                  </ul>
                </>
              )
            }
          </Body>
        </DashboardCard>
      </div>
    </>
  );
}
