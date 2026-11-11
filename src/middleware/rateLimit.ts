import { rateLimit, type RateLimitInfo, type Store } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { getRedis } from '../lib/redis.js';
import { TooManyRequestsError } from '../utils/errors.js';

function store(prefix: string): Store | undefined {
  if (env.RATE_LIMIT_STORE !== 'redis') return undefined; // express-rate-limit's default MemoryStore
  return new RedisStore({
    prefix,
    sendCommand: (command: string, ...args: string[]) =>
      getRedis().call(command, ...args) as Promise<RedisReply>,
  });
}

/** General API limiter: ~100 requests / minute / IP. Responds 429 + Retry-After. */
export const apiRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_API_WINDOW_MS,
  limit: env.RATE_LIMIT_API_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  store: store('rl:api:'),
  // Health checks and provider webhooks (retried from a few provider IPs) are not limited per IP.
  skip: (req) => req.path === '/health' || req.path.startsWith('/payments/webhook/'),
  handler: (req, _res, next) => {
    const resetTime = (req as typeof req & { rateLimit?: RateLimitInfo }).rateLimit?.resetTime;
    const retryAfter = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(env.RATE_LIMIT_API_WINDOW_MS / 1000);
    next(new TooManyRequestsError(retryAfter));
  },
});
