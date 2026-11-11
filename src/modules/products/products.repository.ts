import type { Prisma } from '@prisma/client';
import { prisma, type Db } from '../../lib/prisma.js';

export const productInclude = {
  category: { select: { id: true, slug: true, name: true, isActive: true } },
  variants: true,
} satisfies Prisma.ProductInclude;

export type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export const productRepository = {
  findMany(where: Prisma.ProductWhereInput, skip: number, take: number, db: Db = prisma): Promise<ProductWithRelations[]> {
    return db.product.findMany({
      where,
      skip,
      take,
      include: productInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  },

  count(where: Prisma.ProductWhereInput, db: Db = prisma): Promise<number> {
    return db.product.count({ where });
  },

  findById(id: string, db: Db = prisma): Promise<ProductWithRelations | null> {
    return db.product.findUnique({ where: { id }, include: productInclude });
  },

  findBySlug(slug: string, db: Db = prisma): Promise<ProductWithRelations | null> {
    return db.product.findUnique({ where: { slug }, include: productInclude });
  },

  async hasOrders(id: string, db: Db = prisma): Promise<boolean> {
    return (await db.orderItem.count({ where: { productId: id } })) > 0;
  },
};
