import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { getRedis } from '../lib/redis.js';

const usesRedis = () => env.QUEUE_DRIVER === 'bullmq' || env.RATE_LIMIT_STORE === 'redis';

async function check(fn: () => Promise<unknown>): Promise<'up' | 'down'> {
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2_000)),
    ]);
    return 'up';
  } catch {
    return 'down';
  }
}

export const healthCheck: RequestHandler = async (_req, res) => {
  const [database, redis] = await Promise.all([
    check(() => prisma.$queryRaw`SELECT 1`),
    usesRedis() ? check(() => getRedis().ping()) : Promise.resolve('skipped' as const),
  ]);
  const ok = database === 'up' && redis !== 'down';
  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    checks: { database, redis },
    uptimeSeconds: Math.round(process.uptime()),
  });
};
