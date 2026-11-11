import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError, NotFoundError } from '../utils/errors.js';

interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export const notFoundHandler: RequestHandler = (req) => {
  throw new NotFoundError(`Route ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND');
};

/**
 * Central error handler. Always responds `{ error: { code, message, details? } }` and never leaks
 * stack traces, SQL, or internal messages for unexpected errors.
 */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const send = (status: number, body: ErrorBody, headers?: Record<string, string>) => {
    if (headers) res.set(headers);
    res.status(status).json(body);
  };

  if (err instanceof AppError) {
    if (err.status >= 500) req.log?.error({ err }, err.message);
    return send(
      err.status,
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      },
      err.headers,
    );
  }

  if (err instanceof ZodError) {
    return send(400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | string | undefined) ?? [];
      return send(409, {
        error: {
          code: 'ALREADY_EXISTS',
          message: 'A record with these values already exists',
          details: { fields: target },
        },
      });
    }
    if (err.code === 'P2025')
      return send(404, { error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    if (err.code === 'P2003') {
      return send(409, {
        error: { code: 'REFERENCED_RECORD', message: 'This record is referenced by other records' },
      });
    }
  }

  // body-parser errors (malformed JSON, payload too large)
  const httpErr = err as { type?: string; status?: number };
  if (httpErr.type === 'entity.parse.failed') {
    return send(400, { error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
  }
  if (httpErr.type === 'entity.too.large') {
    return send(413, {
      error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' },
    });
  }

  req.log?.error({ err }, 'unhandled error');
  return send(500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};
