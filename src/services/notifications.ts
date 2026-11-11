import { logger } from '../config/logger.js';
import { prisma } from '../lib/prisma.js';
import { emailQueue } from '../lib/queue.js';
import type { EmailJob } from '../jobs/email.worker.js';
import { env } from '../config/env.js';

/**
 * High-level notification helpers. Each one only *enqueues* work and never throws:
 * a broken mail server must not fail an order or a sign-up.
 */
async function enqueue(job: EmailJob): Promise<void> {
  try {
    await emailQueue.enqueue(job);
  } catch (err) {
    logger.error({ err, template: job.template }, 'failed to enqueue email');
  }
}

async function adminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { email: true } });
  return admins.map((a) => a.email);
}

interface UserLike {
  email: string;
  name: string;
}

interface OrderLike {
  id: string;
  currency: string;
  totalCents: number;
  items: {
    productName: string;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }[];
}

const toLineItems = (order: OrderLike) =>
  order.items.map((i) => ({
    name: i.productName,
    quantity: i.quantity,
    unitPriceCents: i.unitPriceCents,
    lineTotalCents: i.lineTotalCents,
  }));

export const notifications = {
  verifyEmail: (user: UserLike, url: string) =>
    enqueue({ template: 'verifyEmail', to: [user.email], data: { name: user.name, url } }),

  passwordReset: (user: UserLike, url: string, expiresInMinutes: number) =>
    enqueue({
      template: 'passwordReset',
      to: [user.email],
      data: { name: user.name, url, expiresInMinutes },
    }),

  passwordChanged: (user: UserLike) =>
    enqueue({ template: 'passwordChanged', to: [user.email], data: { name: user.name } }),

  accountLocked: (user: UserLike) =>
    enqueue({
      template: 'accountLocked',
      to: [user.email],
      data: { name: user.name, minutes: env.LOCKOUT_DURATION_MINUTES },
    }),

  async orderPlaced(customer: UserLike, order: OrderLike): Promise<void> {
    const items = toLineItems(order);
    await enqueue({
      template: 'orderConfirmation',
      to: [customer.email],
      data: {
        name: customer.name,
        orderId: order.id,
        items,
        totalCents: order.totalCents,
        currency: order.currency,
      },
    });
    try {
      await enqueue({
        template: 'adminNewOrder',
        to: await adminEmails(),
        data: {
          orderId: order.id,
          customerName: customer.name,
          customerEmail: customer.email,
          items,
          totalCents: order.totalCents,
          currency: order.currency,
        },
      });
    } catch (err) {
      logger.error({ err }, 'failed to notify admins of new order');
    }
  },

  orderStatusChanged: (
    customer: UserLike,
    orderId: string,
    previousStatus: string,
    status: string,
    note?: string,
  ) =>
    enqueue({
      template: 'orderStatusChanged',
      to: [customer.email],
      data: { name: customer.name, orderId, previousStatus, status, ...(note ? { note } : {}) },
    }),

  async lowStock(
    products: { name: string; sku: string; stockQuantity: number; lowStockThreshold: number }[],
  ): Promise<void> {
    if (products.length === 0) return;
    try {
      await enqueue({ template: 'lowStockAlert', to: await adminEmails(), data: { products } });
    } catch (err) {
      logger.error({ err }, 'failed to send low-stock alert');
    }
  },
};
