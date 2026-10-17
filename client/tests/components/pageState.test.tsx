import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { NudgeCard, PageEmpty, PageError, PageLoading, PageNoAccess, PageNotFound } from '@/components/feedback/PageState';

const inRouter = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);

describe('page states (deck W86 to W89, src 386 to 422)', () => {
  test('loading: screen-reader "Loading {Page}…" and pulsing grey placeholder blocks', () => {
    const html = renderToStaticMarkup(<PageLoading page="Dashboard" />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading Dashboard…');
    expect(html).not.toContain('animate-spin');
    expect(html).toContain('animate-pulse');
    expect(html.match(/bg-skeleton/g)).toHaveLength(5);
  });

  test('empty: inbox icon, "Nothing here yet" and the page text', () => {
    const html = renderToStaticMarkup(<PageEmpty text="Nothing on your record yet." />);
    expect(html).toContain('>inbox<');
    expect(html).toContain('Nothing here yet');
    expect(html).toContain('Nothing on your record yet.');
  });

  test('error: cloud_off, "Couldn’t load {Page}", the fixed text, the API detail and Try again', () => {
    const html = renderToStaticMarkup(<PageError page="Cases" detail="The server is busy." onRetry={() => undefined} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('>cloud_off<');
    expect(html).toContain('Couldn’t load Cases');
    expect(html).toContain('The server didn’t respond. Nothing was changed. Check your connection and try again.');
    expect(html).toContain('The server is busy.');
    expect(html).toContain('>refresh<');
    expect(html).toContain('Try again');
    expect(html).toContain('rounded-full');
  });

  test('no access: lock, "You don’t have access to {Page}", the text and Go to dashboard', () => {
    const html = inRouter(<PageNoAccess page="Students" />);
    expect(html).toContain('>lock<');
    expect(html).toContain('You don’t have access to Students');
    expect(html).toContain('Your account role doesn’t include this page. If you think this is a mistake, contact the Student Discipline Office.');
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*>Go to dashboard<\/a>/);
  });
});

describe('NudgeCard (src 2074)', () => {
  test('the unread count, an Open inbox pill and a dismiss button', () => {
    const html = inRouter(<NudgeCard text="You have 7 unread notifications." onDismiss={() => undefined} />);
    expect(html).toContain('role="status"');
    expect(html).toContain('>notifications_active<');
    expect(html).toContain('You have 7 unread notifications.');
    expect(html).toMatch(/<a [^>]*href="\/inbox"[^>]*>Open inbox<\/a>/);
    expect(html).toContain('aria-label="Dismiss"');
  });
});

describe('PageError and PageNotFound (a missing record is not a connection problem)', () => {
  test('a 404 shows the not-found state and never the connection advice', () => {
    const html = inRouter(<PageError page="this violation" status={404} detail="Not found" onRetry={() => undefined} />);
    expect(html).toContain('We couldn’t find that violation');
    expect(html).not.toContain('Check your connection');
    expect(html).not.toContain('Try again');
  });

  test('no response (status 0) or a server fault still says the load failed', () => {
    for (const status of [0, 500, 503]) {
      const html = inRouter(<PageError page="this violation" status={status} onRetry={() => undefined} />);
      expect(html).toContain('Couldn’t load this violation');
      expect(html).toContain('Check your connection');
    }
  });

  test('not found can offer a way back', () => {
    const html = inRouter(<PageNotFound what="handbook entry" backTo="/handbook" backLabel="Back to the handbook" />);
    expect(html).toContain('We couldn’t find that handbook entry');
    expect(html).toMatch(/<a [^>]*href="\/handbook"[^>]*>Back to the handbook<\/a>/);
  });
});
