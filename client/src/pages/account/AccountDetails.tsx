import { Link } from 'react-router-dom';
import type { StudentProfileView } from '@shared/types';
import { useAuth } from '@/context/AuthContext';
import { Card, PageHeader, Resource } from '@/components/ui';
import { api } from '@/api/client';
import { useApi } from '@/hooks/useApi';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line py-3 last:border-0">
      <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

function ordinal(level: number): string {
  const suffix = level === 1 ? 'st' : level === 2 ? 'nd' : level === 3 ? 'rd' : 'th';
  return `${level}${suffix} year`;
}

function StudentDetails({ profile }: { profile: StudentProfileView }) {
  return (
    <dl>
      <Field label="Name" value={`${profile.firstName} ${profile.lastName}`} />
      <Field label="Student ID" value={profile.studentId} />
      <Field label="School email" value={profile.email} />
      <Field label="Program" value={profile.program} />
      <Field label="Year level" value={ordinal(profile.yearLevel)} />
    </dl>
  );
}

/** Read-only account details (deck W84). Corrections go through the SDO; the only thing a user changes is the password. */
export function AccountDetailsPage() {
  const { state } = useAuth();
  const isStudent = state.status === 'authenticated' && state.user.role === 'student';
  const profile = useApi(() => (isStudent ? api.myProfile() : Promise.resolve(null)), [isStudent]);
  if (state.status !== 'authenticated') return null;
  const { user } = state;

  return (
    <>
      <PageHeader title="Account details" subtitle="Corrections to these details go through the SDO." />
      <Card className="max-w-xl">
        {isStudent ? (
          <Resource resource={profile} onRetry={profile.reload}>
            {(data) => (data ? <StudentDetails profile={data.profile} /> : null)}
          </Resource>
        ) : (
          <dl>
            <Field label="Name" value={`${user.firstName} ${user.lastName}`} />
            <Field label="Employee ID" value={user.id} />
            <Field label="School email" value={user.email} />
            <Field label="Role" value="SDO Officer" />
          </dl>
        )}
      </Card>
      <p className="mt-4 text-sm">
        <Link to="/account/password" className="font-medium text-primary underline">
          Change password
        </Link>
      </p>
    </>
  );
}
