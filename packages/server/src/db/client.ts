import { PrismaClient } from '@prisma/client';

// Singleton Prisma client.
// Always import from here — never instantiate PrismaClient elsewhere.
export const db = new PrismaClient({
  log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
});
