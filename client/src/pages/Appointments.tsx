import { useState } from 'react';
import { EmptyState, PageHeader, Resource, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { useApi } from '../lib/useApi';

type Tab = 'upcoming' | 'history';

export function AppointmentsPage() {
  const resource = useApi(() => api.myAppointments(), []);
  const [tab, setTab] = useState<Tab>('upcoming');

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Visit the SDO office on any working day in your window, Monday to Saturday, 7:00 AM to 5:00 PM."
      />
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Appointment list">
        {(['upcoming', 'history'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={tab === option}
            onClick={() => setTab(option)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              tab === option ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white text-ink'
            }`}
          >
            {option === 'upcoming' ? 'Upcoming' : 'History'}
          </button>
        ))}
      </div>
      <Resource resource={resource} onRetry={resource.reload}>
        {({ appointments }) => {
          const shown = appointments.filter((a) => a.bucket === tab);
          if (shown.length === 0) {
            return <EmptyState title={tab === 'upcoming' ? 'No upcoming appointments.' : 'No past appointments.'} />;
          }
          return (
            <ul className="space-y-3">
              {shown.map((appointment) => (
                <li key={appointment.id} className="rounded-lg border border-line bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-ink">{appointment.purpose}</span>
                    <StatusPill status={appointment.status} kind="appointment" />
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {formatDate(appointment.startDate)} to {formatDate(appointment.endDate)}
                  </p>
                  {appointment.notes ? <p className="mt-2 text-sm">{appointment.notes}</p> : null}
                  {appointment.cancelReason ? (
                    <p className="mt-2 text-sm">Reason for cancelling: {appointment.cancelReason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          );
        }}
      </Resource>
    </>
  );
}
