import type { OrderStatus, Prisma } from '@prisma/client';
import { prisma, type Db } from '../../lib/prisma.js';

export const orderInclude = {
  items: { orderBy: { id: 'asc' } },
  user: { select: { id: true, email: true, name: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export const orderRepository = {
  findById(id: string, db: Db = prisma): Promise<OrderWithRelations | null> {
    return db.order.findUnique({ where: { id }, include: orderInclude });
  },

  findMany(
    where: Prisma.OrderWhereInput,
    skip: number,
    take: number,
    db: Db = prisma,
  ): Promise<OrderWithRelations[]> {
    return db.order.findMany({
      where,
      skip,
      take,
      include: orderInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  },

  count(where: Prisma.OrderWhereInput, db: Db = prisma): Promise<number> {
    return db.order.count({ where });
  },

  /**
   * Atomically moves an order from one of `from` to `to`. Returns false if the order was not in
   * an allowed state — the conditional WHERE makes concurrent transitions safe (only one wins).
   */
  async transition(
    id: string,
    from: readonly OrderStatus[],
    data: Prisma.OrderUncheckedUpdateManyInput,
    db: Db = prisma,
  ): Promise<boolean> {
    const { count } = await db.order.updateMany({ where: { id, status: { in: [...from] } }, data });
    return count === 1;
  },
};
