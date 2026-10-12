export const DEFAULT_CLIENT_PORT = 5173;

/**
 * The one browser origin the API accepts: the client app. In development and in production alike it is a single
 * origin, `http://localhost:<CLIENT_PORT>` by default (`npm run dev` and `npm start` serve the client on the same
 * port), or `APP_BASE_URL` when the client lives somewhere else. There are no aliases: `http://127.0.0.1:5173`
 * is a different origin and is refused; open the app at `localhost`.
 */
export function defaultClientOrigin(clientPort: string | number | undefined): string {
  return `http://localhost:${clientPort ?? DEFAULT_CLIENT_PORT}`;
}

/**
 * Normalizes a configured origin to the exact string a browser sends in the `Origin` header (scheme, host and
 * port, no path, no trailing slash). Returns null for anything that is not an http(s) origin. Note that
 * `new URL('localhost:5173')` parses with scheme `localhost:` and the origin string "null", so the scheme is
 * checked explicitly.
 */
export function clientOriginFrom(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}
