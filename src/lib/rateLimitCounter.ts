import { env } from '../config/env.js';
import { getRedis } from './redis.js';

export interface RateLimitRule {
  /** Window length in seconds. */
  window: number;
  max: number;
}

export interface ConsumeResult {
  allowed: boolean;
  /** Seconds until the window resets (only when not allowed). */
  retryAfter: number | null;
}

/**
 * Fixed-window counter with an atomic check-and-increment. Shape matches Better Auth's
 * `BetterAuthRateLimitStorage` so the same store backs both Better Auth and our own limiters.
 */
export interface RateLimitCounter {
  consume(key: string, rule: RateLimitRule): Promise<ConsumeResult>;
  reset(key: string): Promise<void>;
}

class MemoryCounter implements RateLimitCounter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  async consume(key: string, rule: RateLimitRule): Promise<ConsumeResult> {
    const now = Date.now();
    this.prune(now);
    const entry = this.hits.get(key);
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + rule.window * 1000 });
      return { allowed: true, retryAfter: null };
    }
    if (entry.count >= rule.max) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    }
    entry.count += 1;
    return { allowed: true, retryAfter: null };
  }

  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  private prune(now: number): void {
    if (this.hits.size < 10_000) return;
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }
}

// KEYS[1] = counter key, ARGV[1] = window ms, ARGV[2] = max.
// Returns { allowed (1/0), pttl }.
const CONSUME_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if current >= tonumber(ARGV[2]) then
  return {0, redis.call('PTTL', KEYS[1])}
end
current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {1, redis.call('PTTL', KEYS[1])}
`;

class RedisCounter implements RateLimitCounter {
  private readonly prefix = 'rl:';

  async consume(key: string, rule: RateLimitRule): Promise<ConsumeResult> {
    const [allowed, pttl] = (await getRedis().eval(
      CONSUME_SCRIPT,
      1,
      this.prefix + key,
      String(rule.window * 1000),
      String(rule.max),
    )) as [number, number];
    if (allowed === 1) return { allowed: true, retryAfter: null };
    return { allowed: false, retryAfter: Math.max(1, Math.ceil(pttl / 1000)) };
  }

  async reset(key: string): Promise<void> {
    await getRedis().del(this.prefix + key);
  }
}

export const rateLimitCounter: RateLimitCounter =
  env.RATE_LIMIT_STORE === 'redis' ? new RedisCounter() : new MemoryCounter();
