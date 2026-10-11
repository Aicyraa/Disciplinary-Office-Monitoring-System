import { defineConfig } from 'prisma/config';

// Loading a Prisma 6 config disables implicit .env loading. Supply env externally.
export default defineConfig({
  schema: 'prisma/schema.prisma',
});
