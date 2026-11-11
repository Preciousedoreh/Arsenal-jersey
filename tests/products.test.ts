import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  createProduct,
  emailsTo,
  loggedInUser,
  resetDb,
  startServer,
  type Client,
} from './helpers.js';

let srv: ReturnType<typeof startServer>;
let server: Server;
let admin: { id: string; email: string; agent: Client };

beforeAll(() => {
  srv = startServer();
  server = srv.server;
});
afterAll(() => srv.close());
beforeEach(async () => {
  await resetDb();
  admin = await loggedInUser(server, { role: 'ADMIN' });
});

const newJersey = {
  name: 'Home Jersey 26/27',
  category: 'JERSEY',
  priceCents: 8999,
  sku: 'jsy-home-2627',
  stockQuantity: 20,
  lowStockThreshold: 5,
  images: ['https://cdn.example.com/home.jpg'],
};

describe('admin product CRUD', () => {
  it('creates, reads, updates and lists products', async () => {
    const created = await admin.agent.post('/api/admin/products').send(newJersey);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: 'Home Jersey 26/27',
      slug: 'home-jersey-26-27',
      sku: 'JSY-HOME-2627',
      priceCents: 8999,
      currency: 'USD',
      stockQuantity: 20,
      isActive: true,
    });
    const id = created.body.data.id as string;

    // Initial stock is audited.
    const movements = await prisma.inventoryMovement.findMany({ where: { productId: id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      change: 20,
      stockAfter: 20,
      reason: 'RESTOCK',
      adminId: admin.id,
    });

    const updated = await admin.agent
      .patch(`/api/admin/products/${id}`)
      .send({ priceCents: 7999, description: 'On sale' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      priceCents: 7999,
      description: 'On sale',
      stockQuantity: 20,
    });

    const pub = await request(server).get('/api/products/home-jersey-26-27');
    expect(pub.status).toBe(200);
    expect(pub.body.data).toMatchObject({ priceCents: 7999, stockQuantity: 20, inStock: true });
    expect(pub.body.data.lowStockThreshold).toBeUndefined(); // admin-only field
  });

  it('rejects stock changes through PATCH (must use the audited stock endpoint)', async () => {
    const p = await createProduct();
    const res = await admin.agent.patch(`/api/admin/products/${p.id}`).send({ stockQuantity: 999 });
    expect(res.status).toBe(400);
  });

  it('validates input and rejects duplicate SKUs', async () => {
    const invalid = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey, priceCents: 12.5 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    expect((await admin.agent.post('/api/admin/products').send(newJersey)).status).toBe(201);
    const dup = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey, name: 'Another' });
    expect(dup.status).toBe(409);
  });

  it('hides inactive products from the public catalogue', async () => {
    const active = await createProduct({ name: 'Visible Scarf' });
    const hidden = await createProduct({ name: 'Hidden Scarf', isActive: false });
    const list = await request(server).get('/api/products?search=scarf');
    expect(list.status).toBe(200);
    expect(list.body.data.map((p: { id: string }) => p.id)).toEqual([active.id]);
    expect((await request(server).get(`/api/products/${hidden.slug}`)).status).toBe(404);

    const adminList = await admin.agent.get('/api/admin/products?status=inactive');
    expect(adminList.body.data.map((p: { id: string }) => p.id)).toEqual([hidden.id]);
  });

  it('paginates and filters by category', async () => {
    for (let i = 0; i < 5; i++) await createProduct();
    await prisma.product.create({
      data: {
        name: 'Mug',
        slug: 'mug',
        sku: 'MUG-1',
        category: 'MERCHANDISE',
        priceCents: 1000,
        currency: 'USD',
        stockQuantity: 5,
      },
    });
    const page = await request(server).get('/api/products?category=JERSEY&page=2&pageSize=2');
    expect(page.body.pagination).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
    expect(page.body.data).toHaveLength(2);
    const merch = await request(server).get('/api/products?category=MERCHANDISE');
    expect(merch.body.data.map((p: { name: string }) => p.name)).toEqual(['Mug']);
  });

  it('hard-deletes never-ordered products and soft-deletes ordered ones', async () => {
    const unused = await createProduct();
    const hard = await admin.agent.delete(`/api/admin/products/${unused.id}`);
    expect(hard.body.data).toEqual({ id: unused.id, mode: 'hard' });
    expect(await prisma.product.findUnique({ where: { id: unused.id } })).toBeNull();

    const ordered = await createProduct();
    const customer = await loggedInUser(server);
    expect(
      (
        await customer.agent
          .post('/api/orders')
          .send({ items: [{ productId: ordered.id, quantity: 1 }] })
      ).status,
    ).toBe(201);

    const soft = await admin.agent.delete(`/api/admin/products/${ordered.id}`);
    expect(soft.body.data).toEqual({ id: ordered.id, mode: 'soft' });
    const row = await prisma.product.findUniqueOrThrow({ where: { id: ordered.id } });
    expect(row.isActive).toBe(false);
    expect(row.deletedAt).not.toBeNull();
    expect((await request(server).get(`/api/products/${ordered.slug}`)).status).toBe(404);
  });
});

describe('partial updates & slugs (regressions)', () => {
  it('PATCH changes only the fields sent', async () => {
    const created = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey, description: 'Keep me', lowStockThreshold: 9, isActive: false });
    const id = created.body.data.id as string;

    const res = await admin.agent.patch(`/api/admin/products/${id}`).send({ priceCents: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      priceCents: 100,
      description: 'Keep me',
      images: newJersey.images,
      lowStockThreshold: 9,
      isActive: false, // must NOT be re-activated by an unrelated edit
    });
  });

  it('keeps a soft-deleted product deleted when other fields are edited', async () => {
    const p = await createProduct();
    await prisma.product.update({
      where: { id: p.id },
      data: { isActive: false, deletedAt: new Date() },
    });
    await admin.agent.patch(`/api/admin/products/${p.id}`).send({ name: 'Renamed' });
    const row = await prisma.product.findUniqueOrThrow({ where: { id: p.id } });
    expect(row.isActive).toBe(false);
    expect(row.deletedAt).not.toBeNull();
  });

  it('rejects an explicitly requested slug that is taken instead of silently changing it', async () => {
    const taken = await createProduct();
    const res = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey, slug: taken.slug });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_TAKEN');

    const other = await createProduct();
    const patch = await admin.agent
      .patch(`/api/admin/products/${other.id}`)
      .send({ slug: taken.slug });
    expect(patch.status).toBe(409);
  });

  it('derives a unique slug from the name when none is given', async () => {
    const a = await admin.agent.post('/api/admin/products').send(newJersey);
    const b = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey, sku: 'JSY-OTHER' });
    expect(a.body.data.slug).toBe('home-jersey-26-27');
    expect(b.body.data.slug).toMatch(/^home-jersey-26-27-[0-9a-f]{6}$/);
  });
});

describe('stock management', () => {
  it('adds stock, sets stock, and audits who did it', async () => {
    const p = await createProduct({ stockQuantity: 10 });

    const add = await admin.agent
      .post(`/api/admin/products/${p.id}/stock`)
      .send({ change: 50, note: 'Delivery #42' });
    expect(add.status).toBe(200);
    expect(add.body.data.stockQuantity).toBe(60);

    const set = await admin.agent.post(`/api/admin/products/${p.id}/stock`).send({ set: 120 });
    expect(set.body.data.stockQuantity).toBe(120);

    const log = await admin.agent.get(`/api/admin/inventory/movements?productId=${p.id}`);
    expect(log.status).toBe(200);
    expect(
      log.body.data.map((m: { change: number; reason: string; stockAfter: number }) => [
        m.change,
        m.reason,
        m.stockAfter,
      ]),
    ).toEqual([
      [60, 'ADJUSTMENT', 120],
      [50, 'RESTOCK', 60],
    ]);
    expect(log.body.data[0].admin).toEqual({ id: admin.id, email: admin.email });
    expect(log.body.data[1].note).toBe('Delivery #42');
  });

  it('refuses to take stock below zero and requires exactly one of change/set', async () => {
    const p = await createProduct({ stockQuantity: 3 });
    const neg = await admin.agent.post(`/api/admin/products/${p.id}/stock`).send({ change: -5 });
    expect(neg.status).toBe(409);
    expect(neg.body.error.code).toBe('STOCK_WOULD_BE_NEGATIVE');
    expect(
      (await admin.agent.post(`/api/admin/products/${p.id}/stock`).send({ change: 1, set: 4 }))
        .status,
    ).toBe(400);
    expect((await admin.agent.post(`/api/admin/products/${p.id}/stock`).send({})).status).toBe(400);
  });

  it('emails admins when an adjustment drops stock to the low-stock threshold', async () => {
    const p = await createProduct({ stockQuantity: 10, lowStockThreshold: 3 });
    await admin.agent.post(`/api/admin/products/${p.id}/stock`).send({ change: -7 });
    expect(emailsTo(admin.email).some((m) => m.subject.startsWith('Low stock alert'))).toBe(true);
  });

  it('shows the inventory dashboard with low-stock items and totals', async () => {
    await createProduct({ stockQuantity: 100, lowStockThreshold: 5 });
    const low = await createProduct({ stockQuantity: 2, lowStockThreshold: 5 });
    const res = await admin.agent.get('/api/admin/inventory?lowStockOnly=true');
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      totalProducts: 2,
      totalUnitsInStock: 102,
      lowStockCount: 1,
    });
    expect(res.body.data.map((r: { productId: string }) => r.productId)).toEqual([low.id]);
  });
});
