import { validated } from '../../middleware/validate.js';
import { inventoryQuery, movementsQuery } from './inventory.schemas.js';
import { inventoryService } from './inventory.service.js';

export const inventoryController = {
  dashboard: validated({ query: inventoryQuery }, async ({ query }, _req, res) => {
    res.json(await inventoryService.dashboard(query));
  }),

  movements: validated({ query: movementsQuery }, async ({ query }, _req, res) => {
    res.json(await inventoryService.movements(query));
  }),
};
