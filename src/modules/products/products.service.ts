import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/errors.js';
import { paginated, skipTake, type Paginated } from '../../utils/pagination.js';
import { slugify } from '../../utils/slug.js';
import { productInclude, productRepository, type ProductWithRelations } from './products.repository.js';
import {
  SIZE_ORDER,
  type AdminListProductsQuery,
  type AdminProduct,
  type CreateProductInput,
  type ListProductsQuery,
  type ProductSpec,
  type PublicProduct,
  type UpdateProductInput,
} from './products.schemas.js';

/** Purchasable and visible: product active and not deleted, in an active category. */
const PUBLIC_VISIBLE: Prisma.ProductWhereInput = { isActive: true, deletedAt: null, category: { isActive: true } };

const sortedSizes = (p: ProductWithRelations) =>
  [...p.variants].sort((a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size));

export function toPublicProduct(p: ProductWithRelations): PublicProduct {
  const sizes = sortedSizes(p).map((v) => ({ size: v.size, stockQuantity: v.stockQuantity, inStock: v.stockQuantity > 0 }));
  const totalStock = sizes.reduce((sum, s) => sum + s.stockQuantity, 0);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    subtitle: p.subtitle,
    description: p.description,
    category: { id: p.category.id, slug: p.category.slug, name: p.category.name },
    priceCents: p.priceCents,
    currency: p.currency,
    sku: p.sku,
    images: p.images,
    features: p.features,
    specs: (p.specs as unknown as ProductSpec[]) ?? [],
    tags: p.tags,
    badge: p.badge,
    isFeatured: p.isFeatured,
    isBestSeller: p.isBestSeller,
    isCustomizable: p.isCustomizable,
    printPriceCents: p.printPriceCents,
    printColor: p.printColor,
    colorName: p.colorName,
    colorHex: p.colorHex,
    rating: p.rating,
    reviewCount: p.reviewCount,
    sizes,
    totalStock,
    inStock: totalStock > 0,
  };
}

export function toAdminProduct(p: ProductWithRelations): AdminProduct {
  const base = toPublicProduct(p);
  return {
    ...base,
    sizes: base.sizes.map((s) => ({ ...s, isLowStock: s.stockQuantity <= p.lowStockThreshold })),
    lowStockThreshold: p.lowStockThreshold,
    isActive: p.isActive,
    deletedAt: p.deletedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function filters(q: ListProductsQuery): Prisma.ProductWhereInput {
  return {
    ...(q.category ? { category: { slug: q.category } } : {}),
    ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
    ...(q.badge ? { badge: q.badge } : {}),
    ...(q.featured !== undefined ? { isFeatured: q.featured } : {}),
    ...(q.bestSeller !== undefined ? { isBestSeller: q.bestSeller } : {}),
  };
}

/**
 * A slug the admin typed must be used exactly (409 if taken); one derived from the name gets a
 * random suffix on collision. (A race on the unique index still surfaces as 409 ALREADY_EXISTS.)
 */
async function resolveSlug(opts: { requested?: string; name: string; excludeId?: string }): Promise<string> {
  if (opts.requested) {
    const taken = await productRepository.findBySlug(opts.requested);
    if (taken && taken.id !== opts.excludeId) {
      throw new ConflictError(`Slug "${opts.requested}" is already in use`, 'SLUG_TAKEN');
    }
    return opts.requested;
  }
  const root = slugify(opts.name) || 'product';
  const existing = await productRepository.findBySlug(root);
  if (!existing || existing.id === opts.excludeId) return root;
  return `${root}-${randomBytes(3).toString('hex')}`;
}

async function assertCategory(categoryId: string): Promise<void> {
  if (!(await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) {
    throw new BadRequestError('That category does not exist', 'CATEGORY_NOT_FOUND', { categoryId });
  }
}

export const productService = {
  async listPublic(q: ListProductsQuery): Promise<Paginated<PublicProduct>> {
    const where = { ...PUBLIC_VISIBLE, ...filters(q) };
    const { skip, take } = skipTake(q);
    const [items, total] = await Promise.all([productRepository.findMany(where, skip, take), productRepository.count(where)]);
    return paginated(items.map(toPublicProduct), total, q);
  },

  async getPublicBySlug(slug: string): Promise<PublicProduct> {
    const p = await productRepository.findBySlug(slug);
    if (!p || !p.isActive || p.deletedAt || !p.category.isActive) throw new NotFoundError('Product');
    return toPublicProduct(p);
  },

  async listAdmin(q: AdminListProductsQuery): Promise<Paginated<AdminProduct>> {
    const status: Prisma.ProductWhereInput =
      q.status === 'active'
        ? { isActive: true, deletedAt: null }
        : q.status === 'inactive'
          ? { isActive: false, deletedAt: null }
          : q.status === 'deleted'
            ? { deletedAt: { not: null } }
            : {};
    const where = { ...status, ...filters(q) };
    const { skip, take } = skipTake(q);
    const [items, total] = await Promise.all([productRepository.findMany(where, skip, take), productRepository.count(where)]);
    return paginated(items.map(toAdminProduct), total, q);
  },

  async getAdmin(id: string): Promise<AdminProduct> {
    const p = await productRepository.findById(id);
    if (!p) throw new NotFoundError('Product');
    return toAdminProduct(p);
  },

  async create(input: CreateProductInput, adminId: string): Promise<AdminProduct> {
    await assertCategory(input.categoryId);
    const slug = await resolveSlug({ requested: input.slug, name: input.name });
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: input.name,
          slug,
          subtitle: input.subtitle,
          description: input.description,
          categoryId: input.categoryId,
          priceCents: input.priceCents,
          currency: input.currency ?? env.STORE_CURRENCY,
          sku: input.sku,
          images: input.images,
          features: input.features,
          specs: input.specs,
          tags: input.tags,
          badge: input.badge,
          isFeatured: input.isFeatured,
          isBestSeller: input.isBestSeller,
          isCustomizable: input.isCustomizable,
          printPriceCents: input.printPriceCents,
          printColor: input.printColor,
          colorName: input.colorName,
          colorHex: input.colorHex,
          lowStockThreshold: input.lowStockThreshold,
          isActive: input.isActive,
          variants: { create: input.sizes.map((s) => ({ size: s.size, stockQuantity: s.stockQuantity })) },
        },
        include: productInclude,
      });
      const opening = created.variants.filter((v) => v.stockQuantity > 0);
      if (opening.length > 0) {
        await tx.inventoryMovement.createMany({
          data: opening.map((v) => ({
            productId: created.id,
            variantId: v.id,
            change: v.stockQuantity,
            stockAfter: v.stockQuantity,
            reason: 'RESTOCK' as const,
            note: 'Initial stock',
            adminId,
          })),
        });
      }
      return created;
    });
    return toAdminProduct(product);
  },

  async update(id: string, input: UpdateProductInput): Promise<AdminProduct> {
    const existing = await productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product');
    if (input.categoryId && input.categoryId !== existing.categoryId) await assertCategory(input.categoryId);
    if (input.slug && input.slug !== existing.slug) {
      await resolveSlug({ requested: input.slug, name: existing.name, excludeId: id });
    }
    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...input,
        specs: input.specs as Prisma.InputJsonValue | undefined,
        // Reactivating a soft-deleted product un-deletes it.
        ...(input.isActive === true && existing.deletedAt ? { deletedAt: null } : {}),
      },
      include: productInclude,
    });
    return toAdminProduct(updated);
  },

  /** Hard-deletes products that were never ordered; otherwise soft-deletes to keep order history intact. */
  async remove(id: string): Promise<{ id: string; mode: 'hard' | 'soft' }> {
    const existing = await productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product');
    const softDelete = async () => {
      await prisma.product.update({ where: { id }, data: { isActive: false, deletedAt: existing.deletedAt ?? new Date() } });
      return { id, mode: 'soft' as const };
    };
    if (await productRepository.hasOrders(id)) return softDelete();
    try {
      await prisma.product.delete({ where: { id } });
      return { id, mode: 'hard' };
    } catch (err) {
      // An order was placed between the check and the delete: the FK (onDelete: Restrict) blocks
      // the hard delete, so fall back to a soft delete instead of failing with a 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') return softDelete();
      throw err;
    }
  },
};
