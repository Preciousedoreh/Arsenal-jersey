import { randomBytes } from 'node:crypto';
import { Prisma, type Product } from '@prisma/client';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { ConflictError, NotFoundError } from '../../utils/errors.js';
import { paginated, skipTake, type Paginated } from '../../utils/pagination.js';
import { slugify } from '../../utils/slug.js';
import { productRepository } from './products.repository.js';
import type {
  AdminListProductsQuery,
  AdminProduct,
  CreateProductInput,
  ListProductsQuery,
  PublicProduct,
  UpdateProductInput,
} from './products.schemas.js';

const PUBLIC_VISIBLE: Prisma.ProductWhereInput = { isActive: true, deletedAt: null };

export function toPublicProduct(p: Product): PublicProduct {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    category: p.category,
    priceCents: p.priceCents,
    currency: p.currency,
    sku: p.sku,
    images: p.images,
    stockQuantity: p.stockQuantity,
    inStock: p.stockQuantity > 0,
  };
}

export function toAdminProduct(p: Product): AdminProduct {
  return {
    ...toPublicProduct(p),
    lowStockThreshold: p.lowStockThreshold,
    isLowStock: p.stockQuantity <= p.lowStockThreshold,
    isActive: p.isActive,
    deletedAt: p.deletedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

function filters(q: ListProductsQuery): Prisma.ProductWhereInput {
  return {
    ...(q.category ? { category: q.category } : {}),
    ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
  };
}

/**
 * A slug the admin typed must be used exactly (409 if taken); one derived from the name gets a
 * random suffix on collision. (A race on the unique index still surfaces as 409 ALREADY_EXISTS.)
 */
async function resolveSlug(opts: {
  requested?: string;
  name: string;
  excludeId?: string;
}): Promise<string> {
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

export const productService = {
  async listPublic(q: ListProductsQuery): Promise<Paginated<PublicProduct>> {
    const where = { ...PUBLIC_VISIBLE, ...filters(q) };
    const { skip, take } = skipTake(q);
    const [items, total] = await Promise.all([
      productRepository.findMany(where, skip, take),
      productRepository.count(where),
    ]);
    return paginated(items.map(toPublicProduct), total, q);
  },

  async getPublicBySlug(slug: string): Promise<PublicProduct> {
    const p = await productRepository.findBySlug(slug);
    if (!p || !p.isActive || p.deletedAt) throw new NotFoundError('Product');
    return toPublicProduct(p);
  },

  async listAdmin(q: AdminListProductsQuery): Promise<Paginated<AdminProduct>> {
    const status: Prisma.ProductWhereInput =
      q.status === 'active'
        ? PUBLIC_VISIBLE
        : q.status === 'inactive'
          ? { isActive: false, deletedAt: null }
          : q.status === 'deleted'
            ? { deletedAt: { not: null } }
            : {};
    const where = { ...status, ...filters(q) };
    const { skip, take } = skipTake(q);
    const [items, total] = await Promise.all([
      productRepository.findMany(where, skip, take),
      productRepository.count(where),
    ]);
    return paginated(items.map(toAdminProduct), total, q);
  },

  async getAdmin(id: string): Promise<AdminProduct> {
    const p = await productRepository.findById(id);
    if (!p) throw new NotFoundError('Product');
    return toAdminProduct(p);
  },

  async create(input: CreateProductInput, adminId: string): Promise<AdminProduct> {
    const slug = await resolveSlug({ requested: input.slug, name: input.name });
    const product = await prisma.$transaction(async (tx) => {
      const created = await productRepository.create(
        {
          name: input.name,
          slug,
          description: input.description,
          category: input.category,
          priceCents: input.priceCents,
          currency: input.currency ?? env.STORE_CURRENCY,
          sku: input.sku,
          images: input.images,
          stockQuantity: input.stockQuantity,
          lowStockThreshold: input.lowStockThreshold,
          isActive: input.isActive,
        },
        tx,
      );
      if (created.stockQuantity > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: created.id,
            change: created.stockQuantity,
            stockAfter: created.stockQuantity,
            reason: 'RESTOCK',
            note: 'Initial stock',
            adminId,
          },
        });
      }
      return created;
    });
    return toAdminProduct(product);
  },

  async update(id: string, input: UpdateProductInput): Promise<AdminProduct> {
    const existing = await productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product');
    if (input.slug && input.slug !== existing.slug) {
      await resolveSlug({ requested: input.slug, name: existing.name, excludeId: id });
    }
    const updated = await productRepository.update(id, {
      ...input,
      // Reactivating a soft-deleted product un-deletes it.
      ...(input.isActive === true && existing.deletedAt ? { deletedAt: null } : {}),
    });
    return toAdminProduct(updated);
  },

  /** Hard-deletes products that were never ordered; otherwise soft-deletes to keep order history intact. */
  async remove(id: string): Promise<{ id: string; mode: 'hard' | 'soft' }> {
    const existing = await productRepository.findById(id);
    if (!existing) throw new NotFoundError('Product');
    const softDelete = async () => {
      await productRepository.update(id, {
        isActive: false,
        deletedAt: existing.deletedAt ?? new Date(),
      });
      return { id, mode: 'soft' as const };
    };
    if (await productRepository.hasOrders(id)) return softDelete();
    try {
      await productRepository.delete(id);
      return { id, mode: 'hard' };
    } catch (err) {
      // An order was placed between the check and the delete: the FK (onDelete: Restrict) blocks
      // the hard delete, so fall back to a soft delete instead of failing with a 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003')
        return softDelete();
      throw err;
    }
  },
};
