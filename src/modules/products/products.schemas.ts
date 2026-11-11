import { z } from 'zod';
import { paginationQuery } from '../../utils/pagination.js';

export const productCategorySchema = z.enum(['JERSEY', 'MERCHANDISE']);
export type ProductCategory = z.infer<typeof productCategorySchema>;

export const productIdParams = z.object({ id: z.string().min(1).max(64) });
export const productSlugParams = z.object({ slug: z.string().min(1).max(160) });

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(140)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug may contain lowercase letters, numbers and single dashes',
  );

export const listProductsQuery = paginationQuery.extend({
  category: productCategorySchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuery>;

export const adminListProductsQuery = listProductsQuery.extend({
  status: z.enum(['active', 'inactive', 'deleted', 'all']).default('all'),
});
export type AdminListProductsQuery = z.infer<typeof adminListProductsQuery>;

/**
 * Field rules WITHOUT defaults. Defaults live only on the create schema: in zod 4, `.partial()`
 * still applies inner `.default()`s, which would make a PATCH silently reset omitted fields.
 */
const productFields = {
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  description: z.string().trim().max(5000),
  category: productCategorySchema,
  /** Integer minor units, e.g. 4999 = $49.99 */
  priceCents: z.number().int().min(0).max(100_000_000),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'ISO-4217 code, e.g. USD'),
  sku: z
    .string()
    .trim()
    .toUpperCase()
    .min(2)
    .max(64)
    .regex(/^[A-Z0-9][A-Z0-9_-]*$/, 'SKU may contain letters, numbers, dashes and underscores'),
  images: z.array(z.url({ protocol: /^https?$/ }).max(2048)).max(10),
  lowStockThreshold: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
};

export const createProductBody = z.strictObject({
  ...productFields,
  slug: productFields.slug.optional(),
  description: productFields.description.default(''),
  currency: productFields.currency.optional(),
  images: productFields.images.default([]),
  stockQuantity: z.number().int().min(0).max(1_000_000).default(0),
  lowStockThreshold: productFields.lowStockThreshold.default(5),
  isActive: productFields.isActive.default(true),
});
export type CreateProductInput = z.infer<typeof createProductBody>;

/**
 * Only the fields sent are changed. Stock is intentionally NOT editable here — use the stock
 * endpoint so every change is audited.
 */
export const updateProductBody = z
  .strictObject(productFields)
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Provide at least one field to update');
export type UpdateProductInput = z.infer<typeof updateProductBody>;

export const stockAdjustmentBody = z
  .strictObject({
    /** Relative change, e.g. +50 (restock) or -3 (damaged). */
    change: z
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((v) => v !== 0, 'change cannot be 0')
      .optional(),
    /** Absolute stock level, e.g. 120. */
    set: z.number().int().min(0).max(1_000_000).optional(),
    reason: z.enum(['RESTOCK', 'ADJUSTMENT']).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((b) => (b.change === undefined) !== (b.set === undefined), {
    message: 'Provide exactly one of "change" or "set"',
  });
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentBody>;

// ── Response shapes (shared with the frontend) ──

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: ProductCategory;
  priceCents: number;
  currency: string;
  sku: string;
  images: string[];
  stockQuantity: number;
  inStock: boolean;
}

export interface AdminProduct extends PublicProduct {
  lowStockThreshold: number;
  isLowStock: boolean;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
