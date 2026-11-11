import { APIError } from 'better-auth/api';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { notifications } from '../services/notifications.js';
import { prisma } from './prisma.js';
import { rateLimitCounter } from './rateLimitCounter.js';

/**
 * Brute-force protection for email/password sign-in, layered on top of Better Auth's per-IP limiter:
 *
 *  1. Per IP + email: at most LOGIN_MAX_ATTEMPTS attempts per LOGIN_WINDOW_SECONDS → 429.
 *  2. Per account (any IP): LOCKOUT_THRESHOLD consecutive failures lock the account for
 *     LOCKOUT_DURATION_MINUTES and email the owner. Tracked by email, so behaviour is identical
 *     for unknown emails (no user enumeration).
 */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const attemptKey = (ip: string, email: string) => `login:${ip}:${email}`;

function tooManyRequests(code: string, message: string, retryAfter: number): APIError {
  return new APIError(
    'TOO_MANY_REQUESTS',
    { code, message },
    { 'Retry-After': String(retryAfter) },
  );
}

export const loginGuard = {
  async beforeAttempt(email: string, ip: string): Promise<void> {
    const lock = await prisma.loginLockout.findUnique({ where: { email } });
    const now = Date.now();
    if (lock?.lockedUntil && lock.lockedUntil.getTime() > now) {
      const retryAfter = Math.ceil((lock.lockedUntil.getTime() - now) / 1000);
      throw tooManyRequests(
        'ACCOUNT_LOCKED',
        'This account is temporarily locked after too many failed sign-in attempts. Try again later.',
        retryAfter,
      );
    }

    const result = await rateLimitCounter.consume(attemptKey(ip, email), {
      window: env.LOGIN_WINDOW_SECONDS,
      max: env.LOGIN_MAX_ATTEMPTS,
    });
    if (!result.allowed) {
      throw tooManyRequests(
        'TOO_MANY_LOGIN_ATTEMPTS',
        'Too many sign-in attempts. Please try again later.',
        result.retryAfter ?? env.LOGIN_WINDOW_SECONDS,
      );
    }
  },

  async onSuccess(email: string, ip: string): Promise<void> {
    await rateLimitCounter.reset(attemptKey(ip, email));
    await prisma.loginLockout.deleteMany({ where: { email } });
  },

  async onFailure(email: string): Promise<void> {
    const row = await prisma.loginLockout.upsert({
      where: { email },
      create: { email, failedAttempts: 1 },
      update: { failedAttempts: { increment: 1 } },
    });
    if (row.failedAttempts < env.LOCKOUT_THRESHOLD) return;

    // Conditional update so concurrent failures lock (and email) exactly once.
    const lockedUntil = new Date(Date.now() + env.LOCKOUT_DURATION_MINUTES * 60_000);
    const { count } = await prisma.loginLockout.updateMany({
      where: { email, failedAttempts: { gte: env.LOCKOUT_THRESHOLD } },
      data: { failedAttempts: 0, lockedUntil },
    });
    if (count === 0) return;

    logger.warn({ lockedUntil }, 'account locked after repeated failed logins');
    const user = await prisma.user.findUnique({
      where: { email },
      select: { email: true, name: true },
    });
    if (user) await notifications.accountLocked(user);
  },
};
