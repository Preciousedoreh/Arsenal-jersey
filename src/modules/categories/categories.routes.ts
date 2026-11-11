import { Router } from 'express';
import { categoryController } from './categories.controller.js';

/** Public — mounted at /api/categories */
export const categoryRoutes = Router().get('/', categoryController.list);

/** Admin — mounted at /api/admin/categories (behind requireAuth + ADMIN) */
export const adminCategoryRoutes = Router()
  .get('/', categoryController.adminList)
  .post('/', categoryController.create)
  .patch('/:id', categoryController.update)
  .delete('/:id', categoryController.remove);
