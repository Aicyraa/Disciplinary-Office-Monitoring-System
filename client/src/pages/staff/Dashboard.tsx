import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { appointmentsApi } from '@/api/appointments';
import { casesApi } from '@/api/cases';
import { clearanceApi } from '@/api/clearance';
import { ACTION_PILL, AllClear, CardBody as Body, DashRow, DashboardCard, Flag, RowBox, StatRow } from '@/components/dashboard/DashboardCards';
import { Spinner } from '@/components/feedback/PageState';
import { useToast } from '@/components/feedback';
import { Icon } from '@/components/ui/Icon';
import { StatTile } from '@/components/ui/StatTile';
import { useApi } from '@/hooks/useApi';
import { manilaToday } from '@/utils/files';
import { formatClock, formatTerm } from '@/utils/format';
import { appointmentRow, clearanceRows, decisionRow, reportRows, sanctionRows } from '@/utils/staffDashboard';

/** "Will escalate": validating this report would turn the student's third minor into a Major (SPEC 4.2). */
function WillEscalate({ submissionRef }: { submissionRef: string }) {
  const preview = useApi(() => casesApi.escalationPreview(submissionRef), [submissionRef]);
  if (preview.status !== 'ready' || preview.data.conversions.length === 0) return null;
  return <Flag>Will escalate</Flag>;
}

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** Staff dashboard (deck W15, M15, M16; src 425 to 541). No page header: the breadcrumb is the title. */
export function StaffHome() {
  const toast = useToast();
  const today = manilaToday();
  const reported = useApi(() => casesApi.staffCases({ status: 'reported', sort: 'oldest' }), []);
  const validated = useApi(() => casesApi.staffCases({ status: 'validated', sort: 'oldest' }), []);
  const appointments = useApi(() => appointmentsApi.staffAppointments({ bucket: 'upcoming' }), []);
  const queue = useApi(() => casesApi.sanctionQueue({ filter: 'active' }), []);
  const roster = useApi(async () => {
    const { current } = await clearanceApi.clearanceTerms();
    return { term: current, data: await clearanceApi.clearanceRoster(current.academicYear, current.semester) };
  }, []);
  const [checkedAt, setCheckedAt] = useState(() => new Date());
  const [checking, setChecking] = useState(false);

  // "Last checked" moves whenever the reports card has fresh data. Depend on the data itself: `useApi` returns a
  // new object every render, so depending on `reported` would set a new Date on every render (an endless loop).
  const reportedData = reported.status === 'ready' ? reported.data : null;
  useEffect(() => {
    if (reportedData) setCheckedAt(new Date());
  }, [reportedData]);

  function refreshAll() {
    setChecking(true);
    reported.reload();
    validated.reload();
    appointments.reload();
    queue.reload();
    roster.reload();
    setTimeout(() => {
      setChecking(false);
      toast.show('Up to date.', 'success');
    }, 600);
  }

  const lastChecked = (
    <span className="flex items-center gap-1.5">
      <span aria-live="polite">Last checked {formatClock(checkedAt)}</span>
      {checking ? (
        <span role="status" className="inline-flex items-center gap-1.5">
          <Spinner />
          Checking…
        </span>
      ) : (
        <button
          type="button"
          onClick={refreshAll}
          aria-label="Refresh"
          title="Refresh"
          className="grid size-[26px] place-items-center rounded-full text-muted hover:bg-primary-tint hover:text-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 focus-visible:outline-none"
        >
          <Icon name="refresh" className="!text-lg" />
        </button>
      )}
    </span>
  );

  const reportsCard = (
    <DashboardCard icon="qr_code_scanner" tone="bad" title="Reports to validate" subtitle={lastChecked} to="/cases?queue=review" actionLabel="Open Cases">
      <StatRow>
        <StatTile label="Reports to validate" value={reported.status === 'ready' ? reported.data.total : '–'} tone={reported.status === 'ready' && reported.data.total > 0 ? 'danger' : 'default'} />
        <StatTile label="Awaiting decision" value={validated.status === 'ready' ? validated.data.total : '–'} />
        <StatTile label="Sanctions to verify" value={queue.status === 'ready' ? queue.data.counts.pendingVerification : '–'} />
      </StatRow>
      <Body resource={reported}>
        {({ cases }) => {
          const rows = reportRows(cases, today).slice(0, 3);
          return (
            <RowBox>
              {rows.length === 0 ? <AllClear>No reports waiting.</AllClear> : null}
              {rows.map((row) => (
                <DashRow
                  key={row.key}
                  title={row.title}
                  sub={row.sub}
                  flag={row.unmatched ? <Flag>No matching record</Flag> : row.submissionRef ? <WillEscalate submissionRef={row.submissionRef} /> : null}
                  action={
                    <Link to={row.href} className={ACTION_PILL}>
                      Validate
                    </Link>
                  }
                />
              ))}
            </RowBox>
          );
        }}
      </Body>
    </DashboardCard>
  );

  const decisionCard = (
    <DashboardCard
      icon="gavel"
      tone="warn"
      title="Awaiting decision"
      subtitle={validated.status === 'ready' ? (validated.data.total ? `${count(validated.data.total, 'case', 'cases')} to decide` : 'All clear') : undefined}
      to="/cases?queue=decide"
      actionLabel="Open cases awaiting decision"
    >
      <Body resource={validated}>
        {({ cases }) => (
          <RowBox>
            {cases.length === 0 ? <AllClear>No cases awaiting a decision.</AllClear> : null}
            {cases.slice(0, 3).map((caseRow) => {
              const row = decisionRow(caseRow, today);
              return (
                <DashRow
                  key={row.key}
                  title={row.title}
                  sub={row.sub}
                  flag={row.flag ? <Flag>{row.flag}</Flag> : null}
                  action={
                    <Link to={row.href} className={ACTION_PILL}>
                      Decide
                    </Link>
                  }
                />
              );
            })}
          </RowBox>
        )}
      </Body>
    </DashboardCard>
  );

  const appointmentsCard = (
    <DashboardCard
      icon="calendar_month"
      tone="info"
      title="Upcoming appointments"
      subtitle={appointments.status === 'ready' ? (appointments.data.total ? `${appointments.data.total} upcoming` : 'Nothing scheduled') : undefined}
      to="/appointments"
      actionLabel="Open Appointments"
      className="flex-1"
    >
      <Body resource={appointments}>
        {({ appointments: list }) => (
          <RowBox>
            {list.length === 0 ? <AllClear>No upcoming appointments.</AllClear> : null}
            {list.slice(0, 3).map((appointment) => {
              const row = appointmentRow(appointment, today);
              return (
                <DashRow
                  key={row.key}
                  title={row.title}
                  sub={row.sub}
                  flag={row.flag ? <Flag>{row.flag}</Flag> : null}
                  action={
                    <Link to={row.href} className={ACTION_PILL}>
                      Open
                    </Link>
                  }
                />
              );
            })}
          </RowBox>
        )}
      </Body>
    </DashboardCard>
  );

  const sanctionsCard = (
    <DashboardCard
      icon="assignment_turned_in"
      tone="warn"
      title="Sanctions"
      subtitle={
        queue.status === 'ready'
          ? `${queue.data.counts.active - queue.data.counts.pendingVerification} in progress · ${queue.data.counts.pendingVerification} to verify`
          : undefined
      }
      to="/cases?queue=sanction"
      actionLabel="Open sanctions"
    >
      <Body resource={queue}>
        {({ sanctions, counts }) => (
          <>
            <StatRow>
              <StatTile label="In progress" value={counts.active - counts.pendingVerification} />
              <StatTile label="Overdue" value={counts.overdue} tone={counts.overdue > 0 ? 'danger' : 'default'} />
              <StatTile label="To verify" value={counts.pendingVerification} />
            </StatRow>
            <RowBox>
              {sanctions.length === 0 ? <AllClear>No sanctions need attention.</AllClear> : null}
              {sanctionRows(sanctions)
                .slice(0, 3)
                .map((row) => (
                  <DashRow
                    key={row.key}
                    title={row.title}
                    sub={row.sub}
                    flag={row.flag ? <Flag>{row.flag}</Flag> : null}
                    action={
                      <Link to={row.href} className={ACTION_PILL}>
                        {row.action}
                      </Link>
                    }
                  />
                ))}
            </RowBox>
          </>
        )}
      </Body>
    </DashboardCard>
  );

  const clearanceCard = (
    <DashboardCard
      icon="task_alt"
      tone="success"
      title="Clearance work"
      subtitle={
        roster.status === 'ready'
          ? roster.data.data.notCleared
            ? `${count(roster.data.data.notCleared, 'student', 'students')} not yet cleared`
            : `All cleared · ${formatTerm(roster.data.term.academicYear, roster.data.term.semester)}`
          : undefined
      }
      to="/clearance"
      actionLabel="Open Clearance"
    >
      <Body resource={roster}>
        {({ term, data }) => {
          const rows = clearanceRows(data.students, term).slice(0, 3);
          return (
            <RowBox>
              {rows.length === 0 ? <AllClear>Every student is cleared this term.</AllClear> : null}
              {rows.map((row) => (
                <DashRow
                  key={row.key}
                  title={row.title}
                  sub={row.sub}
                  flag={row.flag ? <Flag>{row.flag}</Flag> : null}
                  action={
                    <Link to={row.href} className={ACTION_PILL}>
                      Open
                    </Link>
                  }
                />
              ))}
            </RowBox>
          );
        }}
      </Body>
    </DashboardCard>
  );

  return (
    <>
      <h1 className="sr-only">Dashboard</h1>
      <div className="@container">
        <div className="flex flex-col gap-5">
          <div className="grid gap-5 @min-[800px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {reportsCard}
            <div className="flex min-w-0 flex-col gap-5">
              {decisionCard}
              {appointmentsCard}
            </div>
          </div>
          <div className="grid gap-5 @min-[800px]:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            {sanctionsCard}
            {clearanceCard}
          </div>
        </div>
      </div>
    </>
  );
}
