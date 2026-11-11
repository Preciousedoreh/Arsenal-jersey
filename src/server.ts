import type { Worker } from 'bullmq';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startEmailWorker } from './jobs/email.worker.js';
import { prisma } from './lib/prisma.js';
import { emailQueue } from './lib/queue.js';
import { closeRedis } from './lib/redis.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `API listening on http://localhost:${env.PORT}`,
  );
  if (env.API_DOCS_ENABLED) logger.info(`API docs at http://localhost:${env.PORT}/api/docs`);
});

let worker: Worker | undefined;
if (env.QUEUE_DRIVER === 'bullmq' && env.RUN_WORKERS_IN_PROCESS) worker = startEmailWorker();

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down gracefully');

  const force = setTimeout(() => {
    logger.error('graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 15_000);
  force.unref();

  await new Promise<void>((resolve) => server.close(() => resolve()));
  await worker?.close();
  await emailQueue.close();
  await prisma.$disconnect();
  await closeRedis();
  logger.info('shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) =>
  logger.error({ err: reason }, 'unhandled promise rejection'),
);
