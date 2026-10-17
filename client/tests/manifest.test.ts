import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf-8')) as {
  name: string;
  start_url: string;
  display: string;
  theme_color: string;
  icons: Array<{ src: string; sizes: string; type: string }>;
};
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf-8');

describe('web app manifest', () => {
  test('is installable: name, start URL, standalone display, brand color and an icon that exists', () => {
    expect(manifest.name).toContain('SDO Portal');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#35408E');
    expect(manifest.icons.length).toBeGreaterThan(0);
    for (const icon of manifest.icons) {
      expect(icon.type).toBe('image/png');
      expect(() => readFileSync(new URL(`../public${icon.src}`, import.meta.url))).not.toThrow();
    }
  });

  test('has a service worker that serves the shell offline and never caches API calls', () => {
    const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf-8');
    expect(worker).toContain("addEventListener('fetch'");
    expect(worker).toContain("request.mode === 'navigate'");
    expect(worker).toContain("caches.match('/index.html')");
    expect(worker).toContain("!url.pathname.startsWith('/api/')");
    const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf-8');
    expect(main).toContain("navigator.serviceWorker.register('/sw.js')");
  });

  test('index.html links the manifest, the theme color and an icon', () => {
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"');
    expect(html).toContain('name="theme-color" content="#35408E"');
    expect(html).toContain('rel="apple-touch-icon"');
  });
});
