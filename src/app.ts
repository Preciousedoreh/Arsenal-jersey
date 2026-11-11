import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import { pinoHttp } from 'pino-http';
import { toNodeHandler } from 'better-auth/node';
import { allowedOrigins, env } from './config/env.js';
import { logger } from './config/logger.js';
import { auth } from './lib/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import {
  csrfProtection,
  forwardClientIp,
  mirrorRetryAfter,
  writableQuery,
} from './middleware/security.js';
import { paymentWebhook } from './modules/payments/payments.controller.js';
import { uploadDir } from './services/storage/storage.service.js';
import { apiRouter } from './routes.js';
import { docsRouter } from './docs/docs.routes.js';

/** URL for request logs: no query string (verify-email tokens) and no reset token in the path. */
export function safeUrl(url: string | undefined): string | undefined {
  return url?.split('?')[0]?.replace(/(\/reset-password\/)[^/]+/, '$1[redacted]');
}

/** Builds the Express app without listening, so tests can drive it with Supertest. */
export function createApp(): Express {
  const app = express();
  app.set('trust proxy', env.TRUST_PROXY);
  app.disable('x-powered-by');

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && /^[\w-]{1,64}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: safeUrl(req.url),
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      exposedHeaders: ['X-Request-Id', 'Retry-After', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  );
  // Uploaded product photos. Only image files we generated names for are ever stored here. Helmet's
  // default `Cross-Origin-Resource-Policy: same-origin` would stop the storefront (another origin)
  // from showing them, so this path alone allows cross-origin loads.
  app.use(
    '/uploads',
    express.static(uploadDir, {
      index: false,
      dotfiles: 'ignore',
      maxAge: '30d',
      immutable: true, // file names are random and never reused
      setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    }),
  );

  app.use(forwardClientIp);
  app.use('/api', apiRateLimiter);

  // Better Auth parses its own bodies, so it's mounted BEFORE express.json().
  app.all('/api/auth/{*splat}', mirrorRetryAfter, toNodeHandler(auth));

  // Payment webhooks need the raw bytes for signature verification.
  app.post(
    '/api/payments/webhook/:provider',
    express.raw({ type: '*/*', limit: '100kb' }),
    paymentWebhook,
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(writableQuery, hpp());
  app.use(csrfProtection);

  if (env.API_DOCS_ENABLED) app.use('/api/docs', docsRouter());
  app.use('/api', apiRouter());

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
