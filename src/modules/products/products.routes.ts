import { Router } from 'express';
import { productController } from './products.controller.js';

/** Public catalogue — mounted at /api/products */
export const productRoutes = Router()
  .get('/', productController.list)
  .get('/:slug', productController.getBySlug);

/** Admin product management — mounted at /api/admin/products (behind requireAuth + ADMIN) */
export const adminProductRoutes = Router()
  .get('/', productController.adminList)
  .get('/:id', productController.adminGet)
  .post('/', productController.create)
  .patch('/:id', productController.update)
  .delete('/:id', productController.remove)
  .post('/:id/stock', productController.adjustStock);
