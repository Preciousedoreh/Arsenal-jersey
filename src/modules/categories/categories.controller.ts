import { validated } from '../../middleware/validate.js';
import { categoryIdParams, createCategoryBody, updateCategoryBody } from './categories.schemas.js';
import { categoryService } from './categories.service.js';

export const categoryController = {
  list: validated({}, async (_input, _req, res) => {
    res.json({ data: await categoryService.listPublic() });
  }),
  adminList: validated({}, async (_input, _req, res) => {
    res.json({ data: await categoryService.listAdmin() });
  }),
  create: validated({ body: createCategoryBody }, async ({ body }, _req, res) => {
    res.status(201).json({ data: await categoryService.create(body) });
  }),
  update: validated({ params: categoryIdParams, body: updateCategoryBody }, async ({ params, body }, _req, res) => {
    res.json({ data: await categoryService.update(params.id, body) });
  }),
  remove: validated({ params: categoryIdParams }, async ({ params }, _req, res) => {
    res.json({ data: await categoryService.remove(params.id) });
  }),
};
