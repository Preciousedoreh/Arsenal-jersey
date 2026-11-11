import { Router } from 'express';
import { requireAuth, requireVerified } from '../../middleware/auth.js';
import { orderController } from './orders.controller.js';

/** Customer orders — mounted at /api/orders */
export const orderRoutes = Router()
  .use(requireAuth)
  .post('/', requireVerified, orderController.create)
  .get('/', orderController.listOwn)
  .get('/:id', orderController.getOwn)
  .post('/:id/cancel', orderController.cancelOwn)
  .post('/:id/pay', requireVerified, orderController.pay);

/** Mounted at /api/admin/orders (behind requireAuth + ADMIN) */
export const adminOrderRoutes = Router()
  .get('/', orderController.adminList)
  .get('/:id', orderController.adminGet)
  .patch('/:id/status', orderController.adminUpdateStatus);
