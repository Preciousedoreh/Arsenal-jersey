/**
 * Standalone background worker. Run this as a separate process (`npm run start:worker`) and set
 * RUN_WORKERS_IN_PROCESS=false on the API when you want to scale email sending independently.
 */
import { logger } from './config/logger.js';
import { startEmailWorker } from './jobs/email.worker.js';
import { prisma } from './lib/prisma.js';
import { closeRedis } from './lib/redis.js';

const worker = startEmailWorker();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down');
  await worker.close();
  await prisma.$disconnect();
  await closeRedis();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
