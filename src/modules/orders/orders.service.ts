import { Prisma, type OrderStatus } from '@prisma/client';
import type { Size } from '../products/products.schemas.js';
import { logger } from '../../config/logger.js';
import { alertIfLowStock, type StockChange } from '../../jobs/lowStock.js';
import { prisma } from '../../lib/prisma.js';
import { notifications } from '../../services/notifications.js';
import {
  paymentService,
  type PaymentInitiation,
  type PaymentWebhookEvent,
} from '../../services/payment/payment.service.js';
import {
  BadRequestError,
  ConflictError,
  InsufficientStockError,
  NotFoundError,
} from '../../utils/errors.js';
import { paginated, skipTake, type Paginated } from '../../utils/pagination.js';
import { orderInclude, orderRepository, type OrderWithRelations } from './orders.repository.js';
import {
  ORDER_TRANSITIONS,
  type AdminListOrdersQuery,
  type AdminOrderDto,
  type CreateOrderInput,
  type ListOrdersQuery,
  type OrderDto,
  type ShippingAddress,
  type UpdateOrderStatusInput,
} from './orders.schemas.js';

export interface Actor {
  id: string;
  role: 'CUSTOMER' | 'ADMIN';
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function toOrderDto(o: OrderWithRelations): OrderDto {
  return {
    id: o.id,
    status: o.status,
    currency: o.currency,
    subtotalCents: o.subtotalCents,
    totalCents: o.totalCents,
    shippingAddress: (o.shippingAddress as ShippingAddress | null) ?? null,
    paymentProvider: o.paymentProvider,
    paidAt: iso(o.paidAt),
    shippedAt: iso(o.shippedAt),
    deliveredAt: iso(o.deliveredAt),
    cancelledAt: iso(o.cancelledAt),
    cancelReason: o.cancelReason,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      productSku: i.productSku,
      size: i.size,
      customization: (i.customization as { name: string; number: string } | null) ?? null,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      lineTotalCents: i.lineTotalCents,
    })),
  };
}

export function toAdminOrderDto(o: OrderWithRelations): AdminOrderDto {
  return { ...toOrderDto(o), paymentReference: o.paymentReference, customer: o.user };
}

interface Line {
  productId: string;
  size: Size;
  quantity: number;
  customization: { name: string; number: string } | null;
}

/**
 * Merge duplicate lines (same product, size and print) and sort them so concurrent orders take
 * their row locks in the same order (no deadlocks).
 */
function normaliseItems(items: CreateOrderInput['items']): Line[] {
  const merged = new Map<string, Line>();
  for (const item of items) {
    const customization = item.customization ? { name: item.customization.name, number: item.customization.number } : null;
    const key = [item.productId, item.size, customization?.name ?? '', customization?.number ?? ''].join('|');
    const existing = merged.get(key);
    if (existing) existing.quantity += item.quantity;
    else merged.set(key, { productId: item.productId, size: item.size, quantity: item.quantity, customization });
  }
  return [...merged.values()].sort((a, b) => (a.productId + a.size).localeCompare(b.productId + b.size));
}

const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 10_000,
  timeout: 15_000,
} as const;

const STATUS_TIMESTAMP: Partial<Record<OrderStatus, 'paidAt' | 'shippedAt' | 'deliveredAt'>> = {
  PAID: 'paidAt',
  SHIPPED: 'shippedAt',
  DELIVERED: 'deliveredAt',
};

async function loadOrFail(id: string): Promise<OrderWithRelations> {
  const order = await orderRepository.findById(id);
  if (!order) throw new NotFoundError('Order');
  return order;
}

async function refundPayment(reference: string, amountCents: number, orderId: string) {
  try {
    await paymentService.refund(reference, amountCents);
    await prisma.payment.updateMany({ where: { reference }, data: { status: 'REFUNDED' } });
  } catch (err) {
    logger.error({ err, orderId, reference }, 'refund failed — needs manual follow-up');
  }
}

export const orderService = {
  /**
   * Places an order and deducts stock in ONE transaction:
   *  - each size's stock is decremented with a conditional atomic UPDATE
   *    (`... SET stock = stock - qty WHERE id = ? AND stock >= qty`); Postgres re-checks the
   *    condition after waiting on a concurrent writer's row lock, so stock can never oversell;
   *  - if any line can't be fulfilled, the whole transaction rolls back (409 INSUFFICIENT_STOCK);
   *  - prices are computed here from the catalogue (never trusted from the client), including the
   *    name & number print surcharge; order rows store a name/size/price snapshot;
   *  - inventory movements are logged per size with reason ORDER.
   */
  async create(
    customer: { id: string; email: string; name: string },
    input: CreateOrderInput,
  ): Promise<OrderDto> {
    const lines = normaliseItems(input.items);
    const productIds = [...new Set(lines.map((l) => l.productId))];

    const { order, stockChanges } = await prisma.$transaction(async (tx) => {
      const products = new Map(
        (await tx.product.findMany({ where: { id: { in: productIds } }, include: { variants: true } })).map((p) => [p.id, p]),
      );

      const resolved = lines.map((line) => {
        const p = products.get(line.productId);
        if (!p || p.deletedAt) throw new NotFoundError(`Product ${line.productId}`, 'PRODUCT_NOT_FOUND');
        if (!p.isActive) {
          throw new ConflictError(`"${p.name}" is not available for purchase`, 'PRODUCT_UNAVAILABLE', { productId: p.id });
        }
        const variant = p.variants.find((v) => v.size === line.size);
        if (!variant) {
          throw new ConflictError(`"${p.name}" is not sold in size ${line.size}`, 'SIZE_UNAVAILABLE', { productId: p.id, size: line.size });
        }
        if (line.customization && !p.isCustomizable) {
          throw new BadRequestError(`"${p.name}" cannot be personalised`, 'NOT_CUSTOMIZABLE', { productId: p.id });
        }
        return { line, product: p, variant };
      });

      const currencies = new Set(resolved.map((r) => r.product.currency));
      if (currencies.size > 1) throw new BadRequestError('All items in an order must use the same currency', 'MIXED_CURRENCY');

      for (const { line, product, variant } of resolved) {
        const { count } = await tx.productVariant.updateMany({
          where: {
            id: variant.id,
            stockQuantity: { gte: line.quantity },
            product: { isActive: true, deletedAt: null },
          },
          data: { stockQuantity: { decrement: line.quantity } },
        });
        if (count === 0) {
          const fresh = await tx.productVariant.findUnique({
            where: { id: variant.id },
            select: { stockQuantity: true, product: { select: { isActive: true, deletedAt: true } } },
          });
          if (!fresh || !fresh.product.isActive || fresh.product.deletedAt) {
            throw new ConflictError(`"${product.name}" is not available for purchase`, 'PRODUCT_UNAVAILABLE', { productId: product.id });
          }
          throw new InsufficientStockError({
            productId: product.id,
            productName: product.name,
            size: line.size,
            requested: line.quantity,
            available: fresh.stockQuantity,
          });
        }
      }

      const after = new Map(
        (await tx.productVariant.findMany({ where: { id: { in: resolved.map((r) => r.variant.id) } }, select: { id: true, stockQuantity: true } })).map(
          (v) => [v.id, v.stockQuantity],
        ),
      );

      const itemRows = resolved.map(({ line, product, variant }) => {
        const unitPriceCents = product.priceCents + (line.customization ? product.printPriceCents : 0);
        return {
          productId: product.id,
          variantId: variant.id,
          productName: product.name,
          productSku: product.sku,
          size: line.size,
          customization: line.customization ?? Prisma.JsonNull,
          unitPriceCents,
          quantity: line.quantity,
          lineTotalCents: unitPriceCents * line.quantity,
        };
      });
      const subtotalCents = itemRows.reduce((sum, i) => sum + i.lineTotalCents, 0);

      const created = await tx.order.create({
        data: {
          userId: customer.id,
          status: 'PENDING',
          currency: [...currencies][0]!,
          subtotalCents,
          totalCents: subtotalCents, // shipping/tax hooks go here later
          shippingAddress: input.shippingAddress ?? Prisma.JsonNull,
          items: { create: itemRows },
        },
        include: orderInclude,
      });

      await tx.inventoryMovement.createMany({
        data: resolved.map(({ line, product, variant }) => ({
          productId: product.id,
          variantId: variant.id,
          change: -line.quantity,
          stockAfter: after.get(variant.id)!,
          reason: 'ORDER' as const,
          orderId: created.id,
        })),
      });

      const stockChanges: StockChange[] = resolved.map(({ line, product, variant }) => ({
        name: `${product.name} (${line.size})`,
        sku: product.sku,
        stockQuantity: after.get(variant.id)!,
        lowStockThreshold: product.lowStockThreshold,
        change: -line.quantity,
      }));

      return { order: created, stockChanges };
    }, TX_OPTIONS);

    // Side effects only after commit.
    await notifications.orderPlaced(customer, order);
    await alertIfLowStock(stockChanges);
    return toOrderDto(order);
  },

  async listOwn(userId: string, q: ListOrdersQuery): Promise<Paginated<OrderDto>> {
    const where: Prisma.OrderWhereInput = { userId, ...(q.status ? { status: q.status } : {}) };
    const { skip, take } = skipTake(q);
    const [rows, total] = await Promise.all([
      orderRepository.findMany(where, skip, take),
      orderRepository.count(where),
    ]);
    return paginated(rows.map(toOrderDto), total, q);
  },

  async getOwn(userId: string, id: string): Promise<OrderDto> {
    const order = await orderRepository.findById(id);
    // 404 (not 403) for other users' orders, so order IDs can't be probed.
    if (!order || order.userId !== userId) throw new NotFoundError('Order');
    return toOrderDto(order);
  },

  async listAdmin(q: AdminListOrdersQuery): Promise<Paginated<AdminOrderDto>> {
    const where: Prisma.OrderWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.from || q.to
        ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } }
        : {}),
    };
    const { skip, take } = skipTake(q);
    const [rows, total] = await Promise.all([
      orderRepository.findMany(where, skip, take),
      orderRepository.count(where),
    ]);
    return paginated(rows.map(toAdminOrderDto), total, q);
  },

  async getAdmin(id: string): Promise<AdminOrderDto> {
    return toAdminOrderDto(await loadOrFail(id));
  },

  /**
   * Cancels an order and puts its stock back, atomically. Customers may cancel only their own
   * PENDING orders; admins may cancel anything not yet SHIPPED. The order row is locked
   * (SELECT ... FOR UPDATE) so the status check, stock restore and refund decision all use the
   * same state — stock is restored exactly once even if cancellations and payments race.
   */
  async cancel(orderId: string, actor: Actor, reason?: string): Promise<OrderDto> {
    const allowedFrom: OrderStatus[] =
      actor.role === 'ADMIN' ? ['PENDING', 'PAID', 'PROCESSING'] : ['PENDING'];

    const { order, previousStatus, refund } = await prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<
        {
          userId: string;
          status: OrderStatus;
          paymentReference: string | null;
          totalCents: number;
        }[]
      >`SELECT "userId", "status", "paymentReference", "totalCents" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`;
      if (!row || (actor.role !== 'ADMIN' && row.userId !== actor.id)) {
        throw new NotFoundError('Order');
      }
      if (!allowedFrom.includes(row.status)) {
        throw new ConflictError(
          `Order cannot be cancelled while ${row.status}`,
          'ORDER_NOT_CANCELLABLE',
          { status: row.status },
        );
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelReason: reason ?? null,
          cancelledById: actor.id,
        },
      });

      const items = await tx.orderItem.findMany({
        where: { orderId },
        orderBy: { variantId: 'asc' },
      });
      for (const item of items) {
        const variant = await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: { increment: item.quantity } },
          select: { stockQuantity: true },
        });
        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            variantId: item.variantId,
            change: item.quantity,
            stockAfter: variant.stockQuantity,
            reason: 'CANCEL',
            orderId,
            adminId: actor.role === 'ADMIN' ? actor.id : null,
            note: reason ?? null,
          },
        });
      }
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: orderInclude,
      });
      return {
        order,
        previousStatus: row.status,
        refund:
          row.status !== 'PENDING' && row.paymentReference
            ? { reference: row.paymentReference, amountCents: row.totalCents }
            : null,
      };
    }, TX_OPTIONS);

    if (refund) await refundPayment(refund.reference, refund.amountCents, orderId);
    await notifications.orderStatusChanged(
      order.user,
      order.id,
      previousStatus,
      'CANCELLED',
      reason,
    );
    return toOrderDto(order);
  },

  async updateStatus(
    orderId: string,
    input: UpdateOrderStatusInput,
    admin: Actor,
  ): Promise<AdminOrderDto> {
    if (input.status === 'CANCELLED') {
      await this.cancel(orderId, admin, input.note);
      return this.getAdmin(orderId);
    }

    const before = await loadOrFail(orderId);
    const allowedFrom = (Object.keys(ORDER_TRANSITIONS) as OrderStatus[]).filter((s) =>
      ORDER_TRANSITIONS[s].includes(input.status),
    );
    if (!allowedFrom.includes(before.status)) {
      throw new ConflictError(
        `Cannot change order status from ${before.status} to ${input.status}`,
        'INVALID_STATUS_TRANSITION',
        {
          from: before.status,
          to: input.status,
          allowed: ORDER_TRANSITIONS[before.status],
        },
      );
    }

    const tsField = STATUS_TIMESTAMP[input.status];
    const ok = await orderRepository.transition(orderId, [before.status], {
      status: input.status,
      ...(tsField ? { [tsField]: new Date() } : {}),
    });
    if (!ok)
      throw new ConflictError(
        'Order was modified concurrently, please retry',
        'CONCURRENT_MODIFICATION',
      );

    const after = await loadOrFail(orderId);
    await notifications.orderStatusChanged(
      after.user,
      after.id,
      before.status,
      after.status,
      input.note,
    );
    return toAdminOrderDto(after);
  },

  /**
   * Starts a payment attempt. Every attempt gets its own Payment row, so if the customer clicks
   * "pay" twice, a webhook for either reference still resolves to this order.
   */
  async initiatePayment(userId: string, orderId: string): Promise<PaymentInitiation> {
    const order = await orderRepository.findById(orderId);
    if (!order || order.userId !== userId) throw new NotFoundError('Order');
    if (order.status !== 'PENDING')
      throw new ConflictError(`Order is already ${order.status}`, 'ORDER_NOT_PAYABLE');

    const payment = await paymentService.initiate({
      id: order.id,
      totalCents: order.totalCents,
      currency: order.currency,
      customerEmail: order.user.email,
    });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: payment.provider,
        reference: payment.reference,
        amountCents: order.totalCents,
        currency: order.currency,
      },
    });
    return payment;
  },

  /**
   * Called from the payment webhook. Idempotent: each payment is "claimed" once, so replays are
   * no-ops. Money for an order that was cancelled (or already paid by another attempt) is refunded.
   */
  async handlePaymentEvent(
    event: PaymentWebhookEvent,
  ): Promise<{ handled: boolean; status?: OrderStatus; refunded?: boolean }> {
    const payment = await prisma.payment.findUnique({ where: { reference: event.reference } });
    if (!payment) throw new NotFoundError('Payment');

    if (event.type === 'payment.failed') {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED' },
      });
      logger.warn({ orderId: payment.orderId }, 'payment failed');
      return { handled: true };
    }

    if (
      event.amountCents !== payment.amountCents ||
      event.currency.toUpperCase() !== payment.currency
    ) {
      logger.error({ orderId: payment.orderId, event }, 'payment amount/currency mismatch');
      throw new BadRequestError('Payment amount does not match order total', 'PAYMENT_MISMATCH');
    }

    const claimed = await prisma.payment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'SUCCEEDED' },
    });
    if (claimed.count === 0) return { handled: true }; // replayed webhook

    const paidNow = await orderRepository.transition(payment.orderId, ['PENDING'], {
      status: 'PAID',
      paidAt: new Date(),
      paymentProvider: payment.provider,
      paymentReference: payment.reference,
    });
    const order = await loadOrFail(payment.orderId);
    if (paidNow) {
      await notifications.orderStatusChanged(order.user, order.id, 'PENDING', 'PAID');
      return { handled: true, status: 'PAID' };
    }

    // An admin marked the order paid before this webhook arrived: link the payment to it.
    if (order.status !== 'CANCELLED') {
      const { count } = await prisma.order.updateMany({
        where: { id: order.id, paymentReference: null, status: { not: 'CANCELLED' } },
        data: { paymentProvider: payment.provider, paymentReference: payment.reference },
      });
      if (count === 1) return { handled: true, status: order.status };
    }

    // Cancelled, or already paid by a different attempt: give the money back.
    logger.warn(
      { orderId: order.id, status: order.status },
      'refunding payment that cannot be applied',
    );
    await refundPayment(payment.reference, payment.amountCents, order.id);
    return { handled: true, status: order.status, refunded: true };
  },
};
