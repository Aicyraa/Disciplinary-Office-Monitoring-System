import { defineConfig } from 'prisma/config';

// Prisma 7 does not load .env files. The api package scripts load the root .env
// (node --env-file-if-exists). The CLI uses the direct (unpooled) Neon URL; the
// runtime client gets the pooled DATABASE_URL through the pg adapter in src/prisma.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED ?? '',
  },
});
