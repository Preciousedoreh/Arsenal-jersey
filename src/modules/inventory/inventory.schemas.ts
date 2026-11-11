import { z } from 'zod';
import { paginationQuery } from '../../utils/pagination.js';
import { productCategorySchema } from '../products/products.schemas.js';

export const inventoryReasonSchema = z.enum(['RESTOCK', 'ORDER', 'CANCEL', 'ADJUSTMENT']);
export type InventoryReason = z.infer<typeof inventoryReasonSchema>;

const boolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

export const inventoryQuery = paginationQuery.extend({
  category: productCategorySchema.optional(),
  lowStockOnly: boolQuery.default(false),
});
export type InventoryQuery = z.infer<typeof inventoryQuery>;

export const movementsQuery = paginationQuery.extend({
  productId: z.string().min(1).max(64).optional(),
  reason: inventoryReasonSchema.optional(),
});
export type MovementsQuery = z.infer<typeof movementsQuery>;

export interface InventoryRow {
  productId: string;
  name: string;
  sku: string;
  category: z.infer<typeof productCategorySchema>;
  isActive: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  totalSold: number;
}

export interface InventorySummary {
  totalProducts: number;
  totalUnitsInStock: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalUnitsSold: number;
}

export interface InventoryMovementDto {
  id: string;
  productId: string;
  productName: string;
  change: number;
  stockAfter: number;
  reason: InventoryReason;
  note: string | null;
  orderId: string | null;
  admin: { id: string; email: string } | null;
  createdAt: string;
}
