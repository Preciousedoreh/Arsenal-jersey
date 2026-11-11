import { z } from 'zod';

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and single dashes');

export const categoryIdParams = z.object({ id: z.string().min(1).max(64) });

/** Field rules WITHOUT defaults (zod 4's `.partial()` would otherwise re-apply defaults on PATCH). */
const categoryFields = {
  name: z.string().trim().min(2).max(60),
  slug: slugSchema,
  description: z.string().trim().max(300),
  imageUrl: z.url({ protocol: /^https?$/ }).max(2048).nullable(),
  sortOrder: z.number().int().min(-1000).max(1000),
  isActive: z.boolean(),
};

export const createCategoryBody = z.strictObject({
  ...categoryFields,
  slug: categoryFields.slug.optional(),
  description: categoryFields.description.default(''),
  imageUrl: categoryFields.imageUrl.default(null),
  sortOrder: categoryFields.sortOrder.default(0),
  isActive: categoryFields.isActive.default(true),
});
export type CreateCategoryInput = z.infer<typeof createCategoryBody>;

export const updateCategoryBody = z
  .strictObject(categoryFields)
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Provide at least one field to update');
export type UpdateCategoryInput = z.infer<typeof updateCategoryBody>;

export interface CategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  /** Public listing: active products only. Admin listing: all products that are not deleted. */
  productCount: number;
}
