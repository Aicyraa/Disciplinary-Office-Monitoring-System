import { Link } from 'react-router-dom';
import { PageNoAccess } from '@/components/feedback/PageState';
import { EmptyBlock } from '@/components/ui/EmptyBlock';
import { buttonVariants } from '@/components/ui/Button';

/** Shown instead of a redirect when a signed-in user opens a page that belongs to the other role (deck W89). */
export function NoAccessPage() {
  return <PageNoAccess />;
}

export function NotFoundPage() {
  return (
    <section className="rounded-xl border border-line bg-white">
      <EmptyBlock icon="search_off" title="Page not found" className="py-16">
        That page does not exist.
      </EmptyBlock>
      <div className="flex justify-center pb-12">
        <Link to="/" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
          Go to dashboard
        </Link>
      </div>
    </section>
  );
}
