import { getAuth } from '../../middleware/auth.js';
import { validated } from '../../middleware/validate.js';
import { inventoryService } from '../inventory/inventory.service.js';
import {
  adminListProductsQuery,
  createProductBody,
  listProductsQuery,
  productIdParams,
  productSlugParams,
  stockAdjustmentBody,
  updateProductBody,
} from './products.schemas.js';
import { productService } from './products.service.js';

export const productController = {
  list: validated({ query: listProductsQuery }, async ({ query }, _req, res) => {
    res.json(await productService.listPublic(query));
  }),

  getBySlug: validated({ params: productSlugParams }, async ({ params }, _req, res) => {
    res.json({ data: await productService.getPublicBySlug(params.slug) });
  }),

  adminList: validated({ query: adminListProductsQuery }, async ({ query }, _req, res) => {
    res.json(await productService.listAdmin(query));
  }),

  adminGet: validated({ params: productIdParams }, async ({ params }, _req, res) => {
    res.json({ data: await productService.getAdmin(params.id) });
  }),

  create: validated({ body: createProductBody }, async ({ body }, req, res) => {
    res.status(201).json({ data: await productService.create(body, getAuth(req).user.id) });
  }),

  update: validated(
    { params: productIdParams, body: updateProductBody },
    async ({ params, body }, _req, res) => {
      res.json({ data: await productService.update(params.id, body) });
    },
  ),

  remove: validated({ params: productIdParams }, async ({ params }, _req, res) => {
    res.json({ data: await productService.remove(params.id) });
  }),

  adjustStock: validated(
    { params: productIdParams, body: stockAdjustmentBody },
    async ({ params, body }, req, res) => {
      res.json({ data: await inventoryService.adjustStock(params.id, body, getAuth(req).user.id) });
    },
  ),
};
