import { Link } from 'react-router-dom';
import { EmptyState, PageHeader } from '../components/ui';

/** Notifications are built in step 6; until then the inbox is honestly empty. */
export function InboxPage() {
  return (
    <>
      <PageHeader title="Inbox" subtitle="Updates from the SDO office about your cases, sanctions and appointments." />
      <EmptyState title="No notifications yet." hint="Updates from the office will show up here." />
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
