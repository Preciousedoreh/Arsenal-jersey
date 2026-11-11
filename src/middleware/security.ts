import type { RequestHandler } from 'express';
import { allowedOrigins } from '../config/env.js';
import { CLIENT_IP_HEADER } from '../lib/auth.js';
import { ForbiddenError } from '../utils/errors.js';

/**
 * Pass the client IP (as resolved by Express using the TRUST_PROXY setting) to Better Auth
 * through a header we control. Any client-supplied value is overwritten, so it can't be spoofed.
 */
export const forwardClientIp: RequestHandler = (req, _res, next) => {
  req.headers[CLIENT_IP_HEADER] = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  next();
};

/**
 * Better Auth reports its own 429s with `X-Retry-After`. Mirror it to the standard `Retry-After`
 * header so every 429 from this API looks the same to clients.
 */
export const mirrorRetryAfter: RequestHandler = (_req, res, next) => {
  const writeHead = res.writeHead;
  res.writeHead = function patchedWriteHead(
    this: typeof res,
    ...args: Parameters<typeof writeHead>
  ) {
    if (res.statusCode === 429 || args[0] === 429) {
      const value = res.getHeader('x-retry-after');
      if (value !== undefined && !res.hasHeader('retry-after'))
        res.setHeader('Retry-After', String(value));
    }
    return writeHead.apply(this, args);
  } as typeof writeHead;
  next();
};

/**
 * Express 5 exposes `req.query` as a read-only getter, but `hpp` (HTTP parameter pollution)
 * needs to rewrite it. Materialise it as a plain writable property first.
 */
export const writableQuery: RequestHandler = (req, _res, next) => {
  Object.defineProperty(req, 'query', {
    value: { ...req.query },
    writable: true,
    configurable: true,
    enumerable: true,
  });
  next();
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originOf(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

/**
 * CSRF protection for cookie-authenticated requests (OWASP "verify origin with standard headers").
 * State-changing requests that carry cookies must come from an allow-listed Origin (or Referer).
 * Combined with SameSite=Lax session cookies this blocks cross-site form/fetch attacks.
 * Better Auth applies the same check to its own /api/auth routes.
 */
export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method) || !req.headers.cookie) return next();
  const origin = originOf(req.get('origin')) ?? originOf(req.get('referer'));
  if (!origin || !allowedOrigins.has(origin)) {
    throw new ForbiddenError('Request origin not allowed', 'CSRF_ORIGIN_REJECTED');
  }
  next();
};
