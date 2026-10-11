import { createPrismaClient } from '../src/prisma.js';

// Manual live check: inserts one row into connection_test and reads it back.
const prisma = createPrismaClient();

try {
  const created = await prisma.connectionTest.create({
    data: { message: `prisma smoke ${new Date().toISOString()}` },
  });
  const count = await prisma.connectionTest.count();
  console.log('inserted:', created);
  console.log('rows in connection_test:', count);
} finally {
  await prisma.$disconnect();
}
