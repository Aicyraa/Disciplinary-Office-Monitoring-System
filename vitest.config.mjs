import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  // The client's `@/` alias (client/src), so client tests import the way the app does.
  resolve: { alias: { '@': fileURLToPath(new URL('./client/src', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['api/tests/**/*.test.ts', 'client/tests/**/*.test.{ts,tsx}'],
  },
});
