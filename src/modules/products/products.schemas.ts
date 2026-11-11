import { z } from 'zod';
import { paginationQuery } from '../../utils/pagination.js';

export const sizeSchema = z.enum(['S', 'M', 'L', 'XL', 'XXL', 'OS']);
export type Size = z.infer<typeof sizeSchema>;
/** Display order for sizes ("OS" = one size, for non-apparel). */
export const SIZE_ORDER: readonly Size[] = ['S', 'M', 'L', 'XL', 'XXL', 'OS'];

export const badgeSchema = z.enum(['NEW', 'LIMITED']);

export const productIdParams = z.object({ id: z.string().min(1).max(64) });
export const productSlugParams = z.object({ slug: z.string().min(1).max(160) });

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and single dashes');

const hexColour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour');
const boolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

export const listProductsQuery = paginationQuery.extend({
  /** Category slug. */
  category: z.string().trim().min(1).max(80).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  badge: badgeSchema.optional(),
  featured: boolQuery.optional(),
  bestSeller: boolQuery.optional(),
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
  subtitle: z.string().trim().max(120).nullable(),
  description: z.string().trim().max(5000),
  categoryId: z.string().min(1).max(64),
  /** Integer minor units, e.g. 8999 = $89.99 */
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
  /** Ordered gallery: [front, back, detail, …]. Upload files with POST /api/admin/uploads. */
  images: z.array(z.url({ protocol: /^https?$/ }).max(2048)).max(10),
  features: z.array(z.string().trim().min(1).max(160)).max(12),
  specs: z.array(z.strictObject({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(200) })).max(20),
  tags: z.array(z.string().trim().min(1).max(30)).max(12),
  badge: badgeSchema.nullable(),
  isFeatured: z.boolean(),
  isBestSeller: z.boolean(),
  isCustomizable: z.boolean(),
  printPriceCents: z.number().int().min(0).max(100_000),
  printColor: hexColour.nullable(),
  colorName: z.string().trim().max(40).nullable(),
  colorHex: hexColour.nullable(),
  lowStockThreshold: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean(),
};

const stockQuantity = z.number().int().min(0).max(1_000_000);

export const createProductBody = z.strictObject({
  ...productFields,
  slug: productFields.slug.optional(),
  subtitle: productFields.subtitle.default(null),
  description: productFields.description.default(''),
  currency: productFields.currency.optional(),
  images: productFields.images.default([]),
  features: productFields.features.default([]),
  specs: productFields.specs.default([]),
  tags: productFields.tags.default([]),
  badge: productFields.badge.default(null),
  isFeatured: productFields.isFeatured.default(false),
  isBestSeller: productFields.isBestSeller.default(false),
  isCustomizable: productFields.isCustomizable.default(false),
  printPriceCents: productFields.printPriceCents.default(1500),
  printColor: productFields.printColor.default(null),
  colorName: productFields.colorName.default(null),
  colorHex: productFields.colorHex.default(null),
  lowStockThreshold: productFields.lowStockThreshold.default(5),
  isActive: productFields.isActive.default(true),
  /** Sizes on sale, each with its opening stock. */
  sizes: z
    .array(z.strictObject({ size: sizeSchema, stockQuantity }))
    .min(1)
    .max(SIZE_ORDER.length)
    .refine((rows) => new Set(rows.map((r) => r.size)).size === rows.length, 'Each size may appear only once'),
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
    size: sizeSchema,
    /** Relative change, e.g. +50 (restock) or -3 (damaged). */
    change: z
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((v) => v !== 0, 'change cannot be 0')
      .optional(),
    /** Absolute stock level, e.g. 120. */
    set: stockQuantity.optional(),
    reason: z.enum(['RESTOCK', 'ADJUSTMENT']).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .refine((b) => (b.change === undefined) !== (b.set === undefined), {
    message: 'Provide exactly one of "change" or "set"',
  });
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentBody>;

// ── Response shapes (shared with the frontend) ──

export interface ProductSpec {
  label: string;
  value: string;
}

export interface SizeStockDto {
  size: Size;
  stockQuantity: number;
  inStock: boolean;
}

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string;
  category: { id: string; slug: string; name: string };
  priceCents: number;
  currency: string;
  sku: string;
  images: string[];
  features: string[];
  specs: ProductSpec[];
  tags: string[];
  badge: 'NEW' | 'LIMITED' | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  isCustomizable: boolean;
  printPriceCents: number;
  printColor: string | null;
  colorName: string | null;
  colorHex: string | null;
  rating: number | null;
  reviewCount: number;
  sizes: SizeStockDto[];
  totalStock: number;
  inStock: boolean;
}

export interface AdminProduct extends Omit<PublicProduct, 'sizes'> {
  sizes: (SizeStockDto & { isLowStock: boolean })[];
  lowStockThreshold: number;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
