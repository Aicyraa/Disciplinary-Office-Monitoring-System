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
    server: { host: '127.0.0.1', port: devPort, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  };
});
