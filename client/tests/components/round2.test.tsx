import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { GateInput } from '@/pages/public/gate/GateFields';
import { GatePinned } from '@/pages/public/gate/GatePinned';
import { ListHeader } from '@/components/layout/ListHeader';
import { PageActionProvider } from '@/components/layout/PageAction';

describe('GatePinned', () => {
  test('is sticky, names the form and marks the current step', () => {
    const html = renderToStaticMarkup(<GatePinned steps={['Details', 'Violations', 'Review']} current={1} />);
    expect(html).toContain('sticky top-0');
    expect(html).toContain('>Violation Form<');
    expect(html).toContain('>Student Discipline Office<');
    expect(html).toContain('✓');
    expect(html).toContain('aria-current="step"');
  });

  test('shows only the header when there are no steps', () => {
    expect(renderToStaticMarkup(<GatePinned />)).not.toContain('Progress');
  });
});

describe('GateInput', () => {
  test('an error floats under the field and is linked to the input', () => {
    const html = renderToStaticMarkup(<GateInput label="Student ID" error="Enter your student ID." />);
    expect(html).toContain('absolute top-[calc(100%+3px)]');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('Enter your student ID.');
  });
});

describe('ListHeader', () => {
  test('title and subtitle; no pill without a registered action', () => {
    const html = renderToStaticMarkup(
      <PageActionProvider>
        <ListHeader title="Cases" subtitle="Gate reports and staff-recorded violations" />
      </PageActionProvider>,
    );
    expect(html).toContain('>Cases<');
    expect(html).toContain('Gate reports and staff-recorded violations');
    expect(html).not.toContain('<button');
  });
});
