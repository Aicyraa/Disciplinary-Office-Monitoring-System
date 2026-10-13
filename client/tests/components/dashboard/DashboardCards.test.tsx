import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { ACTION_PILL, DashboardCard, DateTile, Kpi, ProgressBar, RowItem } from '@/components/dashboard/DashboardCards';

const render = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('DashboardCard', () => {
  test('a named region with the title, subtitle and a gold link pill', () => {
    const html = render(
      <DashboardCard icon="gavel" title="Active violations" subtitle="3 minor · 0 major" to="/violations" action="View my violations">
        <p>body</p>
      </DashboardCard>,
    );
    expect(html).toContain('<section aria-labelledby="card-active-violations"');
    expect(html).toContain('id="card-active-violations"');
    expect(html).toContain('3 minor · 0 major');
    expect(html).toMatch(/<a [^>]*class="[^"]*bg-gold[^"]*"[^>]*href="\/violations"|<a [^>]*href="\/violations"[^>]*class="[^"]*bg-gold/);
    expect(html).toContain('View my violations');
    expect(html).toContain('<p>body</p>');
  });

  test('no pill when there is nowhere to go', () => {
    expect(render(<DashboardCard icon="gavel" title="Plain">x</DashboardCard>)).not.toContain('<a ');
  });
});

describe('tap targets', () => {
  test('the card pill and the shared action pill are at least 44 px (min-h-11)', () => {
    expect(ACTION_PILL).toContain('min-h-11');
    const html = render(
      <DashboardCard icon="gavel" title="Cases" to="/cases">
        x
      </DashboardCard>,
    );
    expect(html).toContain('min-h-11');
    expect(html).not.toContain('min-h-9');
  });
});

describe('small parts', () => {
  test('Kpi shows the value and its label', () => {
    const html = render(<Kpi value={4} label="Pending review" tone="danger" />);
    expect(html).toContain('>4<');
    expect(html).toContain('Pending review');
    expect(html).toContain('text-danger');
  });

  test('ProgressBar is a named progressbar with its value', () => {
    const html = render(<ProgressBar percent={25} label="Clearance progress" />);
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Clearance progress"');
    expect(html).toContain('aria-valuenow="25"');
    expect(html).toContain('width:25%');
  });

  test('DateTile reads the calendar day without a time zone shift', () => {
    const html = render(<DateTile date="2026-10-12T16:00:00.000Z" />);
    expect(html).toContain('>Mon<');
    expect(html).toContain('>12<');
    expect(html).toContain('>Oct<');
  });

  test('RowItem shows title, meta and the right side', () => {
    const html = render(<RowItem title="Improper uniform" meta="C001 · Minor" right={<span>Pending</span>} />);
    expect(html).toContain('Improper uniform');
    expect(html).toContain('C001 · Minor');
    expect(html).toContain('<span>Pending</span>');
  });
});
