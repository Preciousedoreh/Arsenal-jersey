import { Router } from 'express';
import { requireAuth, requireRole } from './middleware/auth.js';
import { healthCheck } from './modules/health.js';
import { adminInventoryRoutes } from './modules/inventory/inventory.routes.js';
import { adminOrderRoutes, orderRoutes } from './modules/orders/orders.routes.js';
import { adminProductRoutes, productRoutes } from './modules/products/products.routes.js';
import { adminUserRoutes, meRoutes } from './modules/users/users.routes.js';

/** All JSON API routes (mounted at /api). Better Auth and the payment webhook are mounted in app.ts. */
export function apiRouter(): Router {
  const admin = Router()
    .use(requireAuth, requireRole('ADMIN'))
    .use('/products', adminProductRoutes)
    .use('/inventory', adminInventoryRoutes)
    .use('/orders', adminOrderRoutes)
    .use('/users', adminUserRoutes);

  return Router()
    .get('/health', healthCheck)
    .use('/me', meRoutes)
    .use('/products', productRoutes)
    .use('/orders', orderRoutes)
    .use('/admin', admin);
}
