const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'] as const;

/** The port `vite preview` (`npm start` in client/) serves the production build on; see client/vite.config.ts. */
export const LOCAL_PREVIEW_PORT = 4173;

/** `http(s)://localhost|127.0.0.1|[::1]` on any port: a page served from the developer's own machine. */
export function isLoopbackOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return (url.protocol === 'http:' || url.protocol === 'https:') && (LOOPBACK_HOSTS as readonly string[]).includes(url.hostname);
  } catch {
    return false;
  }
}

/**
 * The browser origins the API accepts (CORS). The configured client origin is always allowed.
 *
 * In development only (`loopbackAliases`), and only when the configured origin is on loopback:
 * - its loopback spellings are allowed on the same scheme and port (Vite prints `http://127.0.0.1:5173` while
 *   people type `http://localhost:5173`; both are the same machine), and
 * - so is the local preview server for the built client (`LOCAL_PREVIEW_PORT`), on the same scheme and the
 *   same loopback spellings, so `npm run build` then `npm start` can sign in.
 *
 * No other port, no other scheme and no non-loopback host is ever added.
 */
export function allowedClientOrigins(clientOrigin: string, { loopbackAliases }: { loopbackAliases: boolean }): Set<string> {
  let url: URL;
  try {
    url = new URL(clientOrigin);
  } catch {
    // Not a URL (for example the string "null"): allow nothing rather than guess. The caller reports it.
    return new Set();
  }
  // `new URL('localhost:5173')` parses (scheme "localhost:") and its origin is the string "null". Only real
  // web origins are acceptable.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return new Set();
  const allowed = new Set([url.origin]);
  if (loopbackAliases && (LOOPBACK_HOSTS as readonly string[]).includes(url.hostname)) {
    const ports = new Set([url.port, String(LOCAL_PREVIEW_PORT)]);
    for (const host of LOOPBACK_HOSTS) {
      for (const port of ports) allowed.add(`${url.protocol}//${host}${port ? `:${port}` : ''}`);
    }
  }
  return allowed;
}
