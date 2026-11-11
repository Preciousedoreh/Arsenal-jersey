import { Prisma } from '@prisma/client';
import { alertIfLowStock } from '../../jobs/lowStock.js';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { paginated, skipTake, type Paginated } from '../../utils/pagination.js';
import { productInclude } from '../products/products.repository.js';
import { toAdminProduct } from '../products/products.service.js';
import type { AdminProduct, Size, StockAdjustmentInput } from '../products/products.schemas.js';
import type { InventoryMovementDto, InventoryQuery, InventoryRow, InventorySummary, MovementsQuery } from './inventory.schemas.js';

interface RawRow {
  variantId: string;
  productId: string;
  name: string;
  sku: string;
  size: Size;
  categoryName: string;
  isActive: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  totalSold: number;
}

export const inventoryService = {
  /**
   * Admin stock change for one size ("add 50" or "set to 120"). Runs in a transaction with a row
   * lock so the audit row's `stockAfter` is exact even while orders are being placed concurrently.
   * A size that doesn't exist yet is created on demand (it starts at 0 and the change is applied).
   */
  async adjustStock(productId: string, input: StockAdjustmentInput, adminId: string): Promise<AdminProduct> {
    const { change, name, sku, stockAfter, threshold } = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { name: true, sku: true, lowStockThreshold: true } });
      if (!product) throw new NotFoundError('Product');

      await tx.productVariant.upsert({
        where: { productId_size: { productId, size: input.size } },
        create: { productId, size: input.size, stockQuantity: 0 },
        update: {},
      });
      const [current] = await tx.$queryRaw<{ id: string; stockQuantity: number }[]>`
        SELECT "id", "stockQuantity" FROM "product_variants"
        WHERE "productId" = ${productId} AND "size" = ${input.size}::"Size" FOR UPDATE`;
      if (!current) throw new NotFoundError('Size');

      const delta = input.set !== undefined ? input.set - current.stockQuantity : (input.change ?? 0);
      if (current.stockQuantity + delta < 0) {
        throw new ConflictError('Stock cannot go below zero', 'STOCK_WOULD_BE_NEGATIVE', {
          size: input.size,
          current: current.stockQuantity,
          change: delta,
        });
      }
      if (delta === 0) return { change: 0, name: product.name, sku: product.sku, stockAfter: current.stockQuantity, threshold: product.lowStockThreshold };

      const updated = await tx.productVariant.update({ where: { id: current.id }, data: { stockQuantity: { increment: delta } } });
      await tx.inventoryMovement.create({
        data: {
          productId,
          variantId: current.id,
          change: delta,
          stockAfter: updated.stockQuantity,
          reason: input.reason ?? (delta > 0 && input.change !== undefined ? 'RESTOCK' : 'ADJUSTMENT'),
          note: input.note ?? null,
          adminId,
        },
      });
      return { change: delta, name: product.name, sku: product.sku, stockAfter: updated.stockQuantity, threshold: product.lowStockThreshold };
    });

    await alertIfLowStock([{ name: `${name} (${input.size})`, sku, stockQuantity: stockAfter, lowStockThreshold: threshold, change }]);
    return toAdminProduct((await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: productInclude })));
  },

  /** Per-size stock table + headline numbers. The "low stock" comparison spans two tables, hence raw SQL. */
  async dashboard(q: InventoryQuery): Promise<Paginated<InventoryRow> & { summary: InventorySummary }> {
    const conditions: Prisma.Sql[] = [Prisma.sql`p."deletedAt" IS NULL`];
    if (q.categoryId) conditions.push(Prisma.sql`p."categoryId" = ${q.categoryId}`);
    if (q.lowStockOnly) conditions.push(Prisma.sql`v."stockQuantity" <= p."lowStockThreshold"`);
    const where = Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
    const { skip, take } = skipTake(q);

    const [rows, [totals], [counts], [sold]] = await Promise.all([
      prisma.$queryRaw<RawRow[]>`
        SELECT v."id" AS "variantId", p."id" AS "productId", p."name", p."sku", v."size", c."name" AS "categoryName",
               p."isActive", v."stockQuantity", p."lowStockThreshold",
               COALESCE((SELECT SUM(oi."quantity") FROM "order_items" oi JOIN "orders" o ON o."id" = oi."orderId"
                         WHERE oi."variantId" = v."id" AND o."status" <> 'CANCELLED'), 0)::int AS "totalSold"
        FROM "product_variants" v
        JOIN "products" p ON p."id" = v."productId"
        JOIN "categories" c ON c."id" = p."categoryId"
        ${where}
        ORDER BY v."stockQuantity" ASC, p."name" ASC, v."size" ASC
        LIMIT ${take} OFFSET ${skip}`,
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total FROM "product_variants" v JOIN "products" p ON p."id" = v."productId" ${where}`,
      prisma.$queryRaw<{ products: number; units: number; low: number; out: number }[]>`
        SELECT COUNT(DISTINCT p."id")::int AS products,
               COALESCE(SUM(v."stockQuantity"), 0)::int AS units,
               COUNT(*) FILTER (WHERE v."stockQuantity" <= p."lowStockThreshold")::int AS low,
               COUNT(*) FILTER (WHERE v."stockQuantity" = 0)::int AS out
        FROM "product_variants" v JOIN "products" p ON p."id" = v."productId" WHERE p."deletedAt" IS NULL`,
      prisma.$queryRaw<{ sold: number }[]>`
        SELECT COALESCE(SUM(oi."quantity"), 0)::int AS sold FROM "order_items" oi JOIN "orders" o ON o."id" = oi."orderId" WHERE o."status" <> 'CANCELLED'`,
    ]);

    return {
      summary: {
        totalProducts: counts?.products ?? 0,
        totalUnitsInStock: counts?.units ?? 0,
        lowStockCount: counts?.low ?? 0,
        outOfStockCount: counts?.out ?? 0,
        totalUnitsSold: sold?.sold ?? 0,
      },
      ...paginated(
        rows.map((r) => ({ ...r, isLowStock: r.stockQuantity <= r.lowStockThreshold })),
        totals?.total ?? 0,
        q,
      ),
    };
  },

  async movements(q: MovementsQuery): Promise<Paginated<InventoryMovementDto>> {
    const where: Prisma.InventoryMovementWhereInput = {
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.size ? { variant: { size: q.size } } : {}),
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
          variant: { select: { size: true } },
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
        size: m.variant.size,
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
