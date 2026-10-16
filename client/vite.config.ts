import { fileURLToPath } from 'node:url';
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
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    envDir: rootDir,
    // The API port is not a secret; the client calls http://localhost:<this port> unless VITE_API_URL is set.
    define: { __API_PORT__: JSON.stringify(env.SERVER_PORT ?? '3000') },
    // One origin: the dev server and the preview of the production build both serve http://localhost:<CLIENT_PORT>
    // (they are never run at the same time), and the API allows exactly that origin.
    server: { host: 'localhost', port: devPort, strictPort: true },
    preview: { host: 'localhost', port: devPort, strictPort: true },
    // Stable vendor chunks (PERFORMANCE-SPEC F1): an app-code deploy does not change their hash, so browsers keep
    // them cached. Pages are split per route in routes/AppRoutes.tsx.
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
