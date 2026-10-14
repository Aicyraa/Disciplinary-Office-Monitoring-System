import { Link } from 'react-router-dom';
import { meApi } from '@/api/me';
import { CardBody as Body, DashboardCard, DateTile, EmptyLine, LinkRow, ProgressBar, RowBox, StatRow } from '@/components/dashboard/DashboardCards';
import { StatusPill } from '@/components/ui';
import { StatTile } from '@/components/ui/StatTile';
import { useApi } from '@/hooks/useApi';
import { cn } from '@/utils/cn';
import {
  activeCases,
  appointmentSummary,
  caseCounts,
  clearanceSummary,
  nextAppointment,
  sanctionCounts,
  sanctionRow,
  sanctionsHint,
  violationRow,
  violationsHint,
} from '@/utils/dashboard';
import { formatTerm } from '@/utils/format';

/** Student dashboard (deck W57, M67, M68; src 1003 to 1086). No header: the nudge greets the student. */
export function StudentDashboard() {
  const cases = useApi(() => meApi.myCases(), []);
  const sanctions = useApi(() => meApi.mySanctions(), []);
  const appointments = useApi(() => meApi.myAppointments(), []);
  const clearance = useApi(() => meApi.myClearance(), []);

  const caseTotals = cases.status === 'ready' ? caseCounts(cases.data.cases) : null;
  const sanctionTotals = sanctions.status === 'ready' ? sanctionCounts(sanctions.data.sanctions) : null;
  const upcoming = appointments.status === 'ready' ? appointments.data.appointments.filter((a) => a.bucket === 'upcoming') : [];
  const next = appointments.status === 'ready' ? nextAppointment(appointments.data.appointments) : null;
  const appointment = appointmentSummary(next, upcoming.length);

  const violationsCard = (
    <DashboardCard
      icon="report"
      tone="bad"
      title="Active violations"
      subtitle={caseTotals ? violationsHint(caseTotals) : undefined}
      to="/violations"
      action="View my violations"
      actionLabel="Open My Violations"
      actionAtBottom
    >
      <Body resource={cases}>
        {({ cases: list }) => {
          const counts = caseCounts(list);
          const rows = activeCases(list).slice(0, 5);
          return (
            <>
              <StatRow>
                <StatTile label="Pending review" value={counts.pendingReview} />
                <StatTile label="Validated" value={counts.validated} />
                <StatTile label="Sanction in progress" value={counts.sanctioned} />
              </StatRow>
              <RowBox>
                {rows.length === 0 ? <EmptyLine>No current violations on your record.</EmptyLine> : null}
                {rows.map((c) => {
                  const row = violationRow(c);
                  return <LinkRow key={row.key} to={row.href} title={row.title} sub={row.sub} end={<StatusPill status={c.status} kind="case" />} />;
                })}
              </RowBox>
            </>
          );
        }}
      </Body>
    </DashboardCard>
  );

  const appointmentCard = (
    <DashboardCard
      icon="calendar_month"
      tone="info"
      title="Next appointment"
      subtitle={appointments.status === 'ready' ? appointment.sub : undefined}
      to="/appointments"
      actionLabel="Open Appointments"
    >
      <Body resource={appointments}>
        {({ appointments: list }) => (
          <>
            {next ? (
              <Link
                to={appointment.href}
                className="flex items-center gap-3.5 rounded-[10px] border border-line bg-upload-bg p-3 hover:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:outline-none"
              >
                <DateTile date={next.startDate} />
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block text-sm font-bold text-ink">{appointment.range}</span>
                  <span className="block truncate text-[13px] text-body">{next.purpose}</span>
                  <span className="block text-xs text-muted">Visit any day · 7:00 AM – 5:00 PM</span>
                </span>
                <StatusPill status={next.status} kind="appointment" />
              </Link>
            ) : (
              <EmptyLine dashed>No upcoming appointments.</EmptyLine>
            )}
            <StatRow>
              <StatTile label="Upcoming" value={upcoming.length} />
              <StatTile label="Completed" value={list.filter((a) => a.status === 'completed').length} />
              <StatTile label="Cancelled" value={list.filter((a) => a.status === 'cancelled').length} />
            </StatRow>
          </>
        )}
      </Body>
    </DashboardCard>
  );

  const sanctionsCard = (
    <DashboardCard
      icon="assignment_late"
      tone="warn"
      title="Active sanctions"
      subtitle={sanctionTotals ? sanctionsHint(sanctionTotals) : undefined}
      to="/sanctions"
      actionLabel="Open My Sanctions"
      className="flex-1"
    >
      <Body resource={sanctions}>
        {({ sanctions: list }) => {
          const counts = sanctionCounts(list);
          const open = list.filter((s) => s.status !== 'completed').slice(0, 3);
          return (
            <>
              <StatRow>
                <StatTile label="In progress" value={counts.inProgress} />
                <StatTile label="Pending verification" value={counts.pendingVerification} />
                <StatTile label="Cleared" value={counts.cleared} />
              </StatRow>
              <RowBox>
                {open.length === 0 ? <EmptyLine>No current sanctions.</EmptyLine> : null}
                {open.map((s) => {
                  const row = sanctionRow(s);
                  return <LinkRow key={row.key} to={row.href} title={row.title} sub={row.sub} end={<StatusPill status={s.status} kind="sanction" />} />;
                })}
              </RowBox>
            </>
          );
        }}
      </Body>
    </DashboardCard>
  );

  const clearanceCard = (
    <DashboardCard
      icon="task_alt"
      tone="success"
      title="Clearance"
      subtitle={clearance.status === 'ready' && clearance.data.clearance ? formatTerm(clearance.data.clearance.academicYear, clearance.data.clearance.semester) : undefined}
      to="/clearance"
      action="View progress"
      actionLabel="View clearance progress"
    >
      <Body resource={clearance}>
        {({ clearance: current }) => {
          const summary = clearanceSummary(current);
          if (!summary) return <p className="text-sm text-muted">The SDO has not set up your clearance for this term yet.</p>;
          return (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className={cn('text-[28px] leading-tight font-extrabold', summary.cleared ? 'text-success' : 'text-warn-ink')}>{summary.value}</span>
                <span className="text-[13px] text-muted">{summary.hint}</span>
              </div>
              <ProgressBar percent={summary.percent} label="Clearance progress" tone={summary.cleared ? 'green' : 'gold'} />
            </>
          );
        }}
      </Body>
    </DashboardCard>
  );

  const handbookCard = (
    <DashboardCard icon="menu_book" tone="info" title="Student Handbook" subtitle="Conduct rules and sanctions" to="/handbook" action="Read" actionLabel="Read the Student Handbook">
      <p className="text-sm leading-normal text-pretty text-body">
        The official guide to student conduct at the university. It lists each offense, whether it is minor or major, and the sanction that applies.
      </p>
    </DashboardCard>
  );

  return (
    <>
      <h1 className="sr-only">Dashboard</h1>
      <div className="@container">
        <div className="flex flex-col gap-5">
          <div className="grid items-stretch gap-5 @min-[800px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {violationsCard}
            <div className="flex min-w-0 flex-col gap-5">
              {appointmentCard}
              {sanctionsCard}
            </div>
          </div>
          <div className="grid items-stretch gap-5 @min-[800px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {clearanceCard}
            {handbookCard}
          </div>
        </div>
      </div>
    </>
  );
}
