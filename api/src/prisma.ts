import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// Construct only when database-backed behavior is explicitly needed.
export function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL must be supplied before creating a Prisma client');
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
