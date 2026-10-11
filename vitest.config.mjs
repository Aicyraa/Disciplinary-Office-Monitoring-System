import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    include: ['api/src/app.test.ts', 'client/src/App.test.tsx'],
  },
});
