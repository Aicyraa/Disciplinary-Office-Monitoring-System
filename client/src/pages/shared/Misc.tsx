import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui';

/** Shown instead of a redirect when a signed-in user opens a page that belongs to the other role. */
export function NoAccessPage() {
  return (
    <>
      <PageHeader title="You do not have access to this page" subtitle="This page is for a different kind of account." />
      <p className="text-sm">
        <Link to="/" className="font-medium text-primary underline">
          Go to the dashboard
        </Link>
      </p>
    </>
  );
}

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <p className="text-sm">
        That page does not exist.{' '}
        <Link to="/" className="font-medium text-primary underline">
          Go to the dashboard
        </Link>
        .
      </p>
    </>
  );
}
