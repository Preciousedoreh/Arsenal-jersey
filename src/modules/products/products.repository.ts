import type { Prisma, Product } from '@prisma/client';
import { prisma, type Db } from '../../lib/prisma.js';

export const productRepository = {
  findMany(
    where: Prisma.ProductWhereInput,
    skip: number,
    take: number,
    db: Db = prisma,
  ): Promise<Product[]> {
    return db.product.findMany({
      where,
      skip,
      take,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  },

  count(where: Prisma.ProductWhereInput, db: Db = prisma): Promise<number> {
    return db.product.count({ where });
  },

  findById(id: string, db: Db = prisma): Promise<Product | null> {
    return db.product.findUnique({ where: { id } });
  },

  findBySlug(slug: string, db: Db = prisma): Promise<Product | null> {
    return db.product.findUnique({ where: { slug } });
  },

  async slugExists(slug: string, db: Db = prisma): Promise<boolean> {
    return (await db.product.count({ where: { slug } })) > 0;
  },

  create(data: Prisma.ProductCreateInput, db: Db = prisma): Promise<Product> {
    return db.product.create({ data });
  },

  update(id: string, data: Prisma.ProductUpdateInput, db: Db = prisma): Promise<Product> {
    return db.product.update({ where: { id }, data });
  },

  delete(id: string, db: Db = prisma): Promise<Product> {
    return db.product.delete({ where: { id } });
  },

  async hasOrders(id: string, db: Db = prisma): Promise<boolean> {
    return (await db.orderItem.count({ where: { productId: id } })) > 0;
  },
};
