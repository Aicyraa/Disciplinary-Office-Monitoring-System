import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { ApiError } from '@/api/client';
import { ACTION_PILL, AllClear, CardBody, DashboardCard, DashRow, DateTile, EmptyLine, Flag, LinkRow, ProgressBar } from '@/components/dashboard/DashboardCards';
import { StatTile } from '@/components/ui/StatTile';

const render = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('DashboardCard', () => {
  test('a named region with the title, subtitle and a gold link pill', () => {
    const html = render(
      <DashboardCard icon="report" title="Active violations" subtitle="3 minor · 0 major" to="/violations" action="View my violations">
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

  test('"View all" by default, named for screen readers, and placed after the content when asked', () => {
    const top = render(
      <DashboardCard icon="gavel" title="Cases" to="/cases" actionLabel="Open Cases">
        <p>body</p>
      </DashboardCard>,
    );
    expect(top).toContain('aria-label="Open Cases"');
    expect(top).toContain('View all');
    expect(top.indexOf('View all')).toBeLessThan(top.indexOf('<p>body</p>'));
    const bottom = render(
      <DashboardCard icon="gavel" title="Cases" to="/cases" actionAtBottom>
        <p>body</p>
      </DashboardCard>,
    );
    expect(bottom.indexOf('View all')).toBeGreaterThan(bottom.indexOf('<p>body</p>'));
  });

  test('no pill when there is nowhere to go', () => {
    expect(render(<DashboardCard icon="gavel" title="Plain">x</DashboardCard>)).not.toContain('<a ');
  });
});

describe('tap targets', () => {
  test('pills are 44 px on a phone (min-h-11) and only shrink from the rail width up', () => {
    expect(ACTION_PILL).toContain('min-h-11');
    const html = render(
      <DashboardCard icon="gavel" title="Cases" to="/cases">
        x
      </DashboardCard>,
    );
    expect(html).toContain('min-h-11');
    expect(html).not.toMatch(/(^|[\s"])min-h-9/);
  });
});

describe('small parts', () => {
  test('StatTile shows the value and its label; danger turns the value red', () => {
    const html = render(<StatTile value={4} label="Reports to validate" tone="danger" />);
    expect(html).toContain('>4<');
    expect(html).toContain('Reports to validate');
    expect(html).toContain('text-bad-ink');
  });

  test('LinkRow is one link to the record with title, line and the end slot', () => {
    const html = render(<LinkRow to="/violations/21" title="Inappropriate attire" sub="SDO-2026-021 · Minor · Oct 9" end={<span>Pending</span>} />);
    expect(html).toMatch(/^<a [^>]*href="\/violations\/21"/);
    expect(html).toContain('Inappropriate attire');
    expect(html).toContain('SDO-2026-021 · Minor · Oct 9');
    expect(html).toContain('<span>Pending</span>');
  });

  test('a long row title wraps to two lines instead of being cut off at phone width', () => {
    const long = 'Clearance requirement for the incoming academic term';
    const link = render(<LinkRow to="/x" title={long} sub="line" />);
    expect(link).toContain('line-clamp-2');
    expect(link).not.toMatch(/truncate[^"]*">Clearance requirement/);
    expect(render(<DashRow title={long} sub="line" />)).toContain('line-clamp-2');
  });

  test('Flag, AllClear and EmptyLine carry their text', () => {
    expect(render(<Flag>Will escalate</Flag>)).toContain('Will escalate');
    expect(render(<AllClear>No reports waiting.</AllClear>)).toContain('check_circle');
    expect(render(<EmptyLine dashed>No upcoming appointments.</EmptyLine>)).toContain('border-dashed');
  });

  test('CardBody: a quiet loading line, an error with Try again, or the content', () => {
    const reload = () => undefined;
    expect(render(<CardBody resource={{ status: 'loading', reload }}>{() => 'x'}</CardBody>)).toContain('Loading…');
    const failed = render(<CardBody resource={{ status: 'error', error: new ApiError(500, 'Could not load.', null), reload }}>{() => 'x'}</CardBody>);
    expect(failed).toContain('Could not load.');
    expect(failed).toContain('Try again');
    expect(render(<CardBody resource={{ status: 'ready', data: 3, reload }}>{(n) => `n=${n}`}</CardBody>)).toContain('n=3');
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
    expect(html).toContain('>MON<');
    expect(html).toContain('>12<');
    expect(html).toContain('>Oct<');
  });
});
