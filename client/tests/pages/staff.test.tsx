import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { ReasonForm } from '@/components/feedback/ReasonForm';

describe('ReasonForm', () => {
  test('renders a labelled required field and submit and cancel buttons', () => {
    const html = renderToStaticMarkup(
      <ReasonForm title="Reject this report" label="Reason (required)" submitLabel="Reject" onSubmit={async () => {}} onCancel={() => {}} />,
    );
    expect(html).toContain('Reject this report');
    expect(html).toContain('Reason (required)');
    expect(html).toContain('<textarea');
    expect(html).toContain('Cancel');
  });
});
