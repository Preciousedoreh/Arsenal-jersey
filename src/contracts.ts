/**
 * Shared API contract for the (future) TypeScript frontend: every request schema (zod) and
 * response type in one import. These modules have no server-only dependencies.
 *
 *   import { createOrderBody, type OrderDto } from '<api>/src/contracts';
 */
export * from './utils/pagination.js';
export * from './modules/products/products.schemas.js';
export * from './modules/inventory/inventory.schemas.js';
export * from './modules/orders/orders.schemas.js';
export * from './modules/users/users.schemas.js';

/** Error envelope returned by every non-auth endpoint. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
