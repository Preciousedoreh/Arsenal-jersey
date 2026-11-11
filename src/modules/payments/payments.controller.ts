import type { RequestHandler } from 'express';
import { orderService } from '../orders/orders.service.js';
import {
  InvalidWebhookSignatureError,
  paymentService,
} from '../../services/payment/payment.service.js';
import { BadRequestError, NotFoundError } from '../../utils/errors.js';

/**
 * POST /api/payments/webhook/:provider — mounted with `express.raw()` so the signature is checked
 * against the exact bytes the provider sent.
 */
export const paymentWebhook: RequestHandler = async (req, res) => {
  if (req.params.provider !== paymentService.provider) throw new NotFoundError('Payment provider');
  if (!Buffer.isBuffer(req.body))
    throw new BadRequestError('Expected raw request body', 'INVALID_WEBHOOK');

  let event;
  try {
    event = paymentService.verifyWebhook(req.body, req.headers);
  } catch (err) {
    if (err instanceof InvalidWebhookSignatureError || err instanceof SyntaxError) {
      throw new BadRequestError('Invalid webhook signature or payload', 'INVALID_WEBHOOK');
    }
    throw err;
  }
  res.json({ data: await orderService.handlePaymentEvent(event) });
};
