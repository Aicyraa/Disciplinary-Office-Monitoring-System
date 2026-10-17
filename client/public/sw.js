// SDO Portal service worker: makes the app installable and lets the shell open without a connection, so the
// app can show its own "No internet connection" screen. Records are never cached: API calls (/api/...) and
// every other origin except Google Fonts always go to the network.
const VERSION = 'sdo-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/seal.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Stores a good response for next time; opaque font responses are fine to keep. */
function remember(request, response) {
  if (response.ok || response.type === 'opaque') {
    const copy = response.clone();
    caches.open(VERSION).then((cache) => cache.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Pages: always try the network first so a new deploy shows at once; offline, open the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => remember('/index.html', response))
        .catch(() => caches.match('/index.html').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // Built files carry a content hash, so a cached copy is always right. Fonts: cached copy first, refreshed behind.
  const isAsset = sameOrigin && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/_vercel/');
  if (isAsset || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fresh = fetch(request).then((response) => remember(request, response));
        if (cached) {
          fresh.catch(() => undefined);
          return cached;
        }
        return fresh;
      }),
    );
  }
});
