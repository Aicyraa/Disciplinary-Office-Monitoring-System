import { Link } from 'react-router-dom';
import { PageHeader } from '../components/ui';

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
