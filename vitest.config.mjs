import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    include: ['api/tests/**/*.test.ts', 'client/src/**/*.test.{ts,tsx}'],
  },
});
