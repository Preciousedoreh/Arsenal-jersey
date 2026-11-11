import { Router } from 'express';
import { inventoryController } from './inventory.controller.js';

/** Mounted at /api/admin/inventory (behind requireAuth + ADMIN) */
export const adminInventoryRoutes = Router()
  .get('/', inventoryController.dashboard)
  .get('/movements', inventoryController.movements);
