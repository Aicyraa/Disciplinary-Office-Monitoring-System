import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';
import { OfflineBanner, OfflineScreen } from '@/components/feedback/Offline';

describe('OfflineScreen', () => {
  test('names the missing internet connection and offers a retry', () => {
    const html = renderToStaticMarkup(<OfflineScreen online={false} onRetry={() => undefined} />);
    expect(html).toContain('No internet connection');
    expect(html).toContain('Turn on Wi-Fi or mobile data');
    expect(html).toContain('Try again');
    expect(html).toContain('role="alert"');
  });

  test('says the server is unreachable when the browser is online', () => {
    const html = renderToStaticMarkup(<OfflineScreen online onRetry={() => undefined} />);
    expect(html).toContain('Can’t reach the SDO Portal');
    expect(html).not.toContain('No internet connection');
  });
});

describe('OfflineBanner', () => {
  test('is a status strip about the lost connection', () => {
    const html = renderToStaticMarkup(<OfflineBanner />);
    expect(html).toContain('role="status"');
    expect(html).toContain('No internet connection');
  });
});
