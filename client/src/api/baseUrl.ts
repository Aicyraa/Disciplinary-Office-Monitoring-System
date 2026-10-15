/**
 * Where the browser sends API requests: `VITE_API_URL` when the API lives elsewhere (a real deployment),
 * otherwise `http://localhost:<port>` with the port from the root .env SERVER_PORT.
 *
 * The app and the API are both on `localhost`, in development and in the local production build: one origin
 * pair, no host guessing. (`127.0.0.1` is a different host to a browser; open the app at `localhost`.)
 */
export function resolveApiBaseUrl({ configured, port }: { configured?: string; port: string }): string {
  return configured && configured.trim() !== '' ? configured.trim().replace(/\/$/, '') : `http://localhost:${port}`;
}
