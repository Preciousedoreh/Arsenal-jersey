import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface PaymentInitiation {
  provider: string;
  reference: string;
  /** Hosted checkout page to redirect the customer to (Stripe Checkout / Paystack). */
  checkoutUrl: string | null;
}

export interface PaymentWebhookEvent {
  type: 'payment.succeeded' | 'payment.failed';
  reference: string;
  amountCents: number;
  currency: string;
}

/**
 * Payment provider abstraction. To add Stripe or Paystack:
 *  1. implement this interface (initiate → create a Checkout Session / Paystack transaction,
 *     verifyWebhook → check the provider signature header against the raw body),
 *  2. add the provider to PAYMENT_PROVIDER in env.ts and to `createPaymentService` below.
 * The webhook route (`POST /api/payments/webhook/:provider`) and order logic stay unchanged.
 */
export interface PaymentService {
  readonly provider: string;
  initiate(order: {
    id: string;
    totalCents: number;
    currency: string;
    customerEmail: string;
  }): Promise<PaymentInitiation>;
  /** Verifies the signature and parses the event. Throws on an invalid signature. */
  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): PaymentWebhookEvent;
  refund(reference: string, amountCents: number): Promise<void>;
}

export class InvalidWebhookSignatureError extends Error {}

/** Signs a payload the way the mock provider expects (also used by tests and for local manual testing). */
export function signMockPayload(rawBody: string | Buffer): string {
  return createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
}

export class MockPaymentService implements PaymentService {
  readonly provider = 'mock';

  async initiate(order: { id: string }): Promise<PaymentInitiation> {
    return {
      provider: this.provider,
      reference: `mock_${order.id}_${randomUUID()}`,
      checkoutUrl: null,
    };
  }

  verifyWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): PaymentWebhookEvent {
    const signature = headers['x-mock-signature'];
    if (typeof signature !== 'string') throw new InvalidWebhookSignatureError('Missing signature');
    const expected = Buffer.from(signMockPayload(rawBody), 'hex');
    const given = Buffer.from(signature, 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new InvalidWebhookSignatureError('Invalid signature');
    }
    const body = JSON.parse(rawBody.toString('utf8')) as Partial<PaymentWebhookEvent>;
    if (
      (body.type !== 'payment.succeeded' && body.type !== 'payment.failed') ||
      typeof body.reference !== 'string' ||
      !Number.isInteger(body.amountCents) ||
      typeof body.currency !== 'string'
    ) {
      throw new InvalidWebhookSignatureError('Malformed event');
    }
    return body as PaymentWebhookEvent;
  }

  async refund(reference: string, amountCents: number): Promise<void> {
    logger.info({ reference, amountCents }, 'mock refund issued');
  }
}

function createPaymentService(): PaymentService {
  switch (env.PAYMENT_PROVIDER) {
    case 'mock':
      return new MockPaymentService();
  }
}

export const paymentService: PaymentService = createPaymentService();
