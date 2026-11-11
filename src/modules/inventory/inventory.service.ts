import type { Prisma } from '@prisma/client';
import { alertIfLowStock } from '../../jobs/lowStock.js';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { paginated, skipTake, type Paginated } from '../../utils/pagination.js';
import { toAdminProduct } from '../products/products.service.js';
import type { AdminProduct, StockAdjustmentInput } from '../products/products.schemas.js';
import type {
  InventoryMovementDto,
  InventoryQuery,
  InventoryRow,
  InventorySummary,
  MovementsQuery,
} from './inventory.schemas.js';

const LIVE: Prisma.ProductWhereInput = { deletedAt: null };

/** Units sold per product, excluding cancelled orders. */
async function unitsSold(productIds?: string[]): Promise<Map<string, number>> {
  const rows = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      order: { status: { not: 'CANCELLED' } },
      ...(productIds ? { productId: { in: productIds } } : {}),
    },
    _sum: { quantity: true },
  });
  return new Map(rows.map((r) => [r.productId, r._sum.quantity ?? 0]));
}

export const inventoryService = {
  /**
   * Admin stock change ("add 50" or "set to 120"). Runs in a transaction with a row lock so the
   * audit row's `stockAfter` is exact even while orders are being placed concurrently.
   */
  async adjustStock(
    productId: string,
    input: StockAdjustmentInput,
    adminId: string,
  ): Promise<AdminProduct> {
    const { product, change } = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ stockQuantity: number }[]>`
        SELECT "stockQuantity" FROM "products" WHERE "id" = ${productId} FOR UPDATE`;
      const current = locked[0];
      if (!current) throw new NotFoundError('Product');

      const delta =
        input.set !== undefined ? input.set - current.stockQuantity : (input.change ?? 0);
      if (current.stockQuantity + delta < 0) {
        throw new ConflictError('Stock cannot go below zero', 'STOCK_WOULD_BE_NEGATIVE', {
          current: current.stockQuantity,
          change: delta,
        });
      }
      if (delta === 0) {
        return {
          product: await tx.product.findUniqueOrThrow({ where: { id: productId } }),
          change: 0,
        };
      }

      const updated = await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { increment: delta } },
      });
      await tx.inventoryMovement.create({
        data: {
          productId,
          change: delta,
          stockAfter: updated.stockQuantity,
          reason:
            input.reason ?? (delta > 0 && input.change !== undefined ? 'RESTOCK' : 'ADJUSTMENT'),
          note: input.note ?? null,
          adminId,
        },
      });
      return { product: updated, change: delta };
    });

    await alertIfLowStock([{ ...product, change }]);
    return toAdminProduct(product);
  },

  async dashboard(
    q: InventoryQuery,
  ): Promise<Paginated<InventoryRow> & { summary: InventorySummary }> {
    const where: Prisma.ProductWhereInput = {
      ...LIVE,
      ...(q.category ? { category: q.category } : {}),
      ...(q.lowStockOnly
        ? { stockQuantity: { lte: prisma.product.fields.lowStockThreshold } }
        : {}),
    };
    const { skip, take } = skipTake(q);

    const [products, total, stockAgg, lowStockCount, outOfStockCount, soldAgg] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take,
        orderBy: [{ stockQuantity: 'asc' }, { name: 'asc' }],
      }),
      prisma.product.count({ where }),
      prisma.product.aggregate({ where: LIVE, _sum: { stockQuantity: true }, _count: true }),
      prisma.product.count({
        where: { ...LIVE, stockQuantity: { lte: prisma.product.fields.lowStockThreshold } },
      }),
      prisma.product.count({ where: { ...LIVE, stockQuantity: 0 } }),
      prisma.orderItem.aggregate({
        where: { order: { status: { not: 'CANCELLED' } } },
        _sum: { quantity: true },
      }),
    ]);
    const sold = await unitsSold(products.map((p) => p.id));

    const rows: InventoryRow[] = products.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      isActive: p.isActive,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold,
      isLowStock: p.stockQuantity <= p.lowStockThreshold,
      totalSold: sold.get(p.id) ?? 0,
    }));

    return {
      summary: {
        totalProducts: stockAgg._count,
        totalUnitsInStock: stockAgg._sum.stockQuantity ?? 0,
        lowStockCount,
        outOfStockCount,
        totalUnitsSold: soldAgg._sum.quantity ?? 0,
      },
      ...paginated(rows, total, q),
    };
  },

  async movements(q: MovementsQuery): Promise<Paginated<InventoryMovementDto>> {
    const where: Prisma.InventoryMovementWhereInput = {
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.reason ? { reason: q.reason } : {}),
    };
    const { skip, take } = skipTake(q);
    const [rows, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: {
          product: { select: { name: true } },
          admin: { select: { id: true, email: true } },
        },
      }),
      prisma.inventoryMovement.count({ where }),
    ]);
    return paginated(
      rows.map((m) => ({
        id: m.id,
        productId: m.productId,
        productName: m.product.name,
        change: m.change,
        stockAfter: m.stockAfter,
        reason: m.reason,
        note: m.note,
        orderId: m.orderId,
        admin: m.admin,
        createdAt: m.createdAt.toISOString(),
      })),
      total,
      q,
    );
  },
};
