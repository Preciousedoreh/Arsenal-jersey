import { getAuth } from '../../middleware/auth.js';
import { validated } from '../../middleware/validate.js';
import {
  adminListOrdersQuery,
  cancelOrderBody,
  createOrderBody,
  listOrdersQuery,
  orderIdParams,
  updateOrderStatusBody,
} from './orders.schemas.js';
import { orderService } from './orders.service.js';

export const orderController = {
  create: validated({ body: createOrderBody }, async ({ body }, req, res) => {
    const { user } = getAuth(req);
    res.status(201).json({ data: await orderService.create(user, body) });
  }),

  listOwn: validated({ query: listOrdersQuery }, async ({ query }, req, res) => {
    res.json(await orderService.listOwn(getAuth(req).user.id, query));
  }),

  getOwn: validated({ params: orderIdParams }, async ({ params }, req, res) => {
    res.json({ data: await orderService.getOwn(getAuth(req).user.id, params.id) });
  }),

  cancelOwn: validated(
    { params: orderIdParams, body: cancelOrderBody },
    async ({ params, body }, req, res) => {
      const { user } = getAuth(req);
      // Even admins go through the customer rules on this endpoint; they use the admin status endpoint otherwise.
      res.json({
        data: await orderService.cancel(params.id, { id: user.id, role: 'CUSTOMER' }, body.reason),
      });
    },
  ),

  pay: validated({ params: orderIdParams }, async ({ params }, req, res) => {
    res.json({ data: await orderService.initiatePayment(getAuth(req).user.id, params.id) });
  }),

  adminList: validated({ query: adminListOrdersQuery }, async ({ query }, _req, res) => {
    res.json(await orderService.listAdmin(query));
  }),

  adminGet: validated({ params: orderIdParams }, async ({ params }, _req, res) => {
    res.json({ data: await orderService.getAdmin(params.id) });
  }),

  adminUpdateStatus: validated(
    { params: orderIdParams, body: updateOrderStatusBody },
    async ({ params, body }, req, res) => {
      const { user } = getAuth(req);
      res.json({
        data: await orderService.updateStatus(params.id, body, { id: user.id, role: 'ADMIN' }),
      });
    },
  ),
};
