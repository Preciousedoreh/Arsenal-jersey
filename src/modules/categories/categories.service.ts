import type { Category, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { slugify } from '../../utils/slug.js';
import type { CategoryDto, CreateCategoryInput, UpdateCategoryInput } from './categories.schemas.js';

type WithCount = Category & { _count: { products: number } };

const toDto = (c: WithCount): CategoryDto => ({
  id: c.id,
  slug: c.slug,
  name: c.name,
  description: c.description,
  imageUrl: c.imageUrl,
  sortOrder: c.sortOrder,
  isActive: c.isActive,
  productCount: c._count.products,
});

const ORDER: Prisma.CategoryOrderByWithRelationInput[] = [{ sortOrder: 'asc' }, { name: 'asc' }];

async function assertSlugFree(slug: string, excludeId?: string): Promise<void> {
  const taken = await prisma.category.findUnique({ where: { slug } });
  if (taken && taken.id !== excludeId) throw new ConflictError(`Slug "${slug}" is already in use`, 'SLUG_TAKEN');
}

export const categoryService = {
  /** Storefront: active categories with their count of purchasable products. */
  async listPublic(): Promise<CategoryDto[]> {
    const rows = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: ORDER,
      include: { _count: { select: { products: { where: { isActive: true, deletedAt: null } } } } },
    });
    return rows.map(toDto);
  },

  async listAdmin(): Promise<CategoryDto[]> {
    const rows = await prisma.category.findMany({
      orderBy: ORDER,
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    return rows.map(toDto);
  },

  async create(input: CreateCategoryInput): Promise<CategoryDto> {
    const slug = input.slug ?? (slugify(input.name) || 'category');
    await assertSlugFree(slug);
    const created = await prisma.category.create({
      data: { name: input.name, slug, description: input.description, imageUrl: input.imageUrl, sortOrder: input.sortOrder, isActive: input.isActive },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    return toDto(created);
  },

  async update(id: string, input: UpdateCategoryInput): Promise<CategoryDto> {
    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError('Category');
    if (input.slug && input.slug !== existing.slug) await assertSlugFree(input.slug, id);
    const updated = await prisma.category.update({
      where: { id },
      data: input,
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    return toDto(updated);
  },

  /** Refuses while any product (even a soft-deleted one) still belongs to the category. */
  async remove(id: string): Promise<{ id: string }> {
    const existing = await prisma.category.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
    if (!existing) throw new NotFoundError('Category');
    if (existing._count.products > 0) {
      throw new ConflictError(
        `"${existing.name}" still has ${existing._count.products} product(s). Move or delete them first, or hide the category instead.`,
        'CATEGORY_NOT_EMPTY',
        { productCount: existing._count.products },
      );
    }
    await prisma.category.delete({ where: { id } });
    return { id };
  },
};
