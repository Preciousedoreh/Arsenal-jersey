import { PrismaClient, type Prisma } from '@prisma/client';
import { isProduction, isTest } from '../config/env.js';

export const prisma = new PrismaClient({
  // Errors are surfaced through our error handler/logger; tests deliberately trigger some.
  log: isTest ? [] : isProduction ? ['error'] : ['error', 'warn'],
});

/** Either the root client or an interactive-transaction client; repositories accept both. */
export type Db = PrismaClient | Prisma.TransactionClient;
