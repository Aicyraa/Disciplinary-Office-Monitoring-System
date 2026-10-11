const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'] as const;

/**
 * The browser origins the API accepts (CORS). The configured client origin is always allowed. In development
 * only, a loopback origin also allows its loopback aliases on the same scheme and port: Vite prints
 * `http://127.0.0.1:5173` while people type `http://localhost:5173`, and both are the same machine. The port
 * and scheme are never widened, and nothing but loopback hosts is added.
 */
export function allowedClientOrigins(clientOrigin: string, { loopbackAliases }: { loopbackAliases: boolean }): Set<string> {
  let url: URL;
  try {
    url = new URL(clientOrigin);
  } catch {
    return new Set([clientOrigin]);
  }
  const allowed = new Set([url.origin]);
  if (loopbackAliases && (LOOPBACK_HOSTS as readonly string[]).includes(url.hostname)) {
    for (const host of LOOPBACK_HOSTS) allowed.add(`${url.protocol}//${host}${url.port ? `:${url.port}` : ''}`);
  }
  return allowed;
}
