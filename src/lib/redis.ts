import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

let shared: Redis | undefined;

/** Shared connection for general commands (rate limiting, health checks). Created lazily. */
export function getRedis(): Redis {
  if (!shared) {
    shared = new Redis(env.REDIS_URL, { maxRetriesPerRequest: 3, enableReadyCheck: true });
    shared.on('error', (err) => logger.error({ err }, 'redis error'));
  }
  return shared;
}

/** BullMQ requires dedicated connections with `maxRetriesPerRequest: null`. */
export function createBullConnection(): Redis {
  const conn = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  conn.on('error', (err) => logger.error({ err }, 'redis (bullmq) error'));
  return conn;
}

export function isRedisInUse(): boolean {
  return shared !== undefined;
}

export async function closeRedis(): Promise<void> {
  if (shared) {
    await shared.quit().catch(() => shared?.disconnect());
    shared = undefined;
  }
}
