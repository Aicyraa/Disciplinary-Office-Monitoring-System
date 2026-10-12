import { loadEnv } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Shared env lives in the repo-root .env. Only VITE_-prefixed keys reach client code.
const rootDir = new URL('..', import.meta.url).pathname;

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, rootDir, ''), ...process.env };
  const devPort = Number(env.CLIENT_PORT ?? 5173);

  return {
    plugins: [react(), tailwindcss()],
    envDir: rootDir,
    // The API port is not a secret; the client calls http://localhost:<this port> unless VITE_API_URL is set.
    define: { __API_PORT__: JSON.stringify(env.SERVER_PORT ?? '3000') },
    // One origin: the dev server and the preview of the production build both serve http://localhost:<CLIENT_PORT>
    // (they are never run at the same time), and the API allows exactly that origin.
    server: { host: 'localhost', port: devPort, strictPort: true },
    preview: { host: 'localhost', port: devPort, strictPort: true },
  };
});
