import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { userController } from './users.controller.js';

/** Mounted at /api/me */
export const meRoutes = Router()
  .use(requireAuth)
  .get('/', userController.me)
  .patch('/', userController.updateMe);

/** Mounted at /api/admin/users (behind requireAuth + ADMIN) */
export const adminUserRoutes = Router()
  .get('/', userController.list)
  .patch('/:id/role', userController.setRole);
