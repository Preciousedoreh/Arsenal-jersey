/**
 * Typed application errors. The central error handler turns these into
 * `{ error: { code, message, details? } }` responses.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST', details?: unknown) {
    super(400, code, message, details);
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown, message = 'Request validation failed') {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(401, code, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    super(403, code, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', code = 'NOT_FOUND') {
    super(404, code, `${resource} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT', details?: unknown) {
    super(409, code, message, details);
  }
}

export interface InsufficientStockDetails {
  productId: string;
  productName: string;
  size?: string;
  requested: number;
  available: number;
}

export class InsufficientStockError extends ConflictError {
  constructor(details: InsufficientStockDetails) {
    super(
      `Insufficient stock for "${details.productName}"${details.size ? ` (size ${details.size})` : ''}`,
      'INSUFFICIENT_STOCK',
      details,
    );
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    retryAfterSeconds: number,
    message = 'Too many requests, please try again later',
    code = 'RATE_LIMITED',
  ) {
    super(429, code, message, { retryAfterSeconds }, { 'Retry-After': String(retryAfterSeconds) });
  }
}
