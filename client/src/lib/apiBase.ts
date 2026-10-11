const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

interface PageLocation {
  protocol: string;
  hostname: string;
}

/**
 * Where the browser should send API requests.
 *
 * The session cookie is only sent when the page and the API share a host, and CORS compares the page's origin
 * with the one the API allows. `localhost` and `127.0.0.1` are the same machine but different hosts, and Vite
 * prints `http://127.0.0.1:5173` while people type `http://localhost:5173`. So in development the API address
 * follows whichever loopback spelling the page itself was opened with.
 *
 * - `configured` (VITE_API_URL) wins, except that a loopback host in it is replaced by the page's loopback host.
 * - Without it, the API is on the page's own host at `port` (the root .env SERVER_PORT).
 * - A non-loopback address is never rewritten.
 */
export function resolveApiBaseUrl({
  configured,
  page,
  port,
}: {
  configured?: string;
  page?: PageLocation;
  port: string;
}): string {
  if (!configured) {
    return page ? `${page.protocol}//${page.hostname}:${port}` : `http://localhost:${port}`;
  }
  if (!page || !LOOPBACK_HOSTS.has(page.hostname)) return configured;
  try {
    const url = new URL(configured);
    if (!LOOPBACK_HOSTS.has(url.hostname) || url.hostname === page.hostname) return configured;
    url.hostname = page.hostname;
    return url.toString().replace(/\/$/, '');
  } catch {
    return configured;
  }
}
