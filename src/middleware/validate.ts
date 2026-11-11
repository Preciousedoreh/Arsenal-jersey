import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

type Schemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

type Out<T> = T extends z.ZodType ? z.output<T> : undefined;

export interface Validated<S extends Schemas> {
  body: Out<S['body']>;
  query: Out<S['query']>;
  params: Out<S['params']>;
}

/**
 * Wraps a controller so its body/query/params are parsed with zod first. Handlers receive fully
 * typed, coerced input; a parse failure throws a ZodError → 400 VALIDATION_ERROR in the error handler.
 * Express 5 forwards rejected promises to the error handler automatically.
 */
export function validated<S extends Schemas>(
  schemas: S,
  handler: (input: Validated<S>, req: Request, res: Response) => Promise<unknown> | unknown,
): RequestHandler {
  return async (req, res) => {
    const input = {
      body: schemas.body ? schemas.body.parse(req.body ?? {}) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
    } as Validated<S>;
    await handler(input, req, res);
  };
}
