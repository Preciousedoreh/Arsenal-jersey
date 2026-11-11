import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import {
  createCategory,
  createProduct,
  defaultCategory,
  emailsTo,
  loggedInUser,
  resetDb,
  startServer,
  stockOf,
  type Client,
} from './helpers.js';

let srv: ReturnType<typeof startServer>;
let server: Server;
let admin: { id: string; email: string; agent: Client };
let categoryId: string;

beforeAll(() => {
  srv = startServer();
  server = srv.server;
});
afterAll(() => srv.close());
beforeEach(async () => {
  await resetDb();
  admin = await loggedInUser(server, { role: 'ADMIN' });
  categoryId = (await defaultCategory()).id;
});

const newJersey = () => ({
  name: 'Home Jersey 26/27',
  categoryId,
  priceCents: 8999,
  sku: 'jsy-home-2627',
  sizes: [
    { size: 'M', stockQuantity: 20 },
    { size: 'L', stockQuantity: 5 },
  ],
  lowStockThreshold: 3,
  images: ['https://cdn.example.com/home.jpg'],
});

describe('admin product CRUD', () => {
  it('creates, reads, updates and lists products with per-size stock', async () => {
    const created = await admin.agent.post('/api/admin/products').send(newJersey());
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      name: 'Home Jersey 26/27',
      slug: 'home-jersey-26-27',
      sku: 'JSY-HOME-2627',
      priceCents: 8999,
      currency: 'USD',
      totalStock: 25,
      isActive: true,
      category: { id: categoryId, slug: 'test-category' },
    });
    expect(
      created.body.data.sizes.map((s: { size: string; stockQuantity: number }) => [
        s.size,
        s.stockQuantity,
      ]),
    ).toEqual([
      ['M', 20],
      ['L', 5],
    ]);
    const id = created.body.data.id as string;

    // Opening stock is audited per size.
    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: id },
      include: { variant: true },
    });
    expect(movements.map((m) => [m.variant.size, m.change, m.stockAfter, m.reason]).sort()).toEqual(
      [
        ['L', 5, 5, 'RESTOCK'],
        ['M', 20, 20, 'RESTOCK'],
      ],
    );
    expect(movements.every((m) => m.adminId === admin.id)).toBe(true);

    const updated = await admin.agent
      .patch(`/api/admin/products/${id}`)
      .send({ priceCents: 7999, description: 'On sale' });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({
      priceCents: 7999,
      description: 'On sale',
      totalStock: 25,
    });

    const pub = await request(server).get('/api/products/home-jersey-26-27');
    expect(pub.status).toBe(200);
    expect(pub.body.data).toMatchObject({ priceCents: 7999, totalStock: 25, inStock: true });
    expect(pub.body.data.lowStockThreshold).toBeUndefined(); // admin-only field
  });

  it('stores the full set of storefront fields', async () => {
    const res = await admin.agent.post('/api/admin/products').send({
      ...newJersey(),
      subtitle: '2026 Home Kit',
      features: ['Recycled polyester', 'Mesh back'],
      specs: [{ label: 'Fabric', value: '100% polyester' }],
      tags: ['Home', '2026/27'],
      badge: 'NEW',
      isFeatured: true,
      isBestSeller: true,
      isCustomizable: true,
      printPriceCents: 1500,
      printColor: '#FFFFFF',
      colorName: 'Home Red',
      colorHex: '#EF0107',
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      subtitle: '2026 Home Kit',
      features: ['Recycled polyester', 'Mesh back'],
      specs: [{ label: 'Fabric', value: '100% polyester' }],
      tags: ['Home', '2026/27'],
      badge: 'NEW',
      isFeatured: true,
      isBestSeller: true,
      isCustomizable: true,
      printColor: '#FFFFFF',
      colorHex: '#EF0107',
    });
    const bad = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey(), sku: 'X-2', colorHex: 'red' });
    expect(bad.status).toBe(400);
  });

  it('rejects stock and size changes through PATCH (stock must use the audited endpoint)', async () => {
    const p = await createProduct();
    for (const body of [{ sizes: [{ size: 'M', stockQuantity: 999 }] }, { stockQuantity: 999 }]) {
      expect((await admin.agent.patch(`/api/admin/products/${p.id}`).send(body)).status).toBe(400);
    }
  });

  it('validates input and rejects duplicate SKUs, unknown categories and bad size lists', async () => {
    const invalid = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey(), priceCents: 12.5 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');

    expect((await admin.agent.post('/api/admin/products').send(newJersey())).status).toBe(201);
    expect(
      (await admin.agent.post('/api/admin/products').send({ ...newJersey(), name: 'Another' }))
        .status,
    ).toBe(409);

    const unknownCat = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey(), sku: 'NEW-1', categoryId: 'nope' });
    expect(unknownCat.status).toBe(400);
    expect(unknownCat.body.error.code).toBe('CATEGORY_NOT_FOUND');

    const noSizes = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey(), sku: 'NEW-2', sizes: [] });
    expect(noSizes.status).toBe(400);
    const dupSizes = await admin.agent.post('/api/admin/products').send({
      ...newJersey(),
      sku: 'NEW-3',
      sizes: [
        { size: 'M', stockQuantity: 1 },
        { size: 'M', stockQuantity: 2 },
      ],
    });
    expect(dupSizes.status).toBe(400);
  });

  it('hides inactive products, and products in hidden categories, from the public catalogue', async () => {
    const active = await createProduct({ name: 'Visible Scarf' });
    const hidden = await createProduct({ name: 'Hidden Scarf', isActive: false });
    const hiddenCat = await createCategory({ isActive: false });
    const inHiddenCat = await createProduct({
      name: 'Scarf in hidden category',
      categoryId: hiddenCat.id,
    });

    const list = await request(server).get('/api/products?search=scarf');
    expect(list.body.data.map((p: { id: string }) => p.id)).toEqual([active.id]);
    expect((await request(server).get(`/api/products/${hidden.slug}`)).status).toBe(404);
    expect((await request(server).get(`/api/products/${inHiddenCat.slug}`)).status).toBe(404);

    const adminInactive = await admin.agent.get('/api/admin/products?status=inactive');
    expect(adminInactive.body.data.map((p: { id: string }) => p.id)).toEqual([hidden.id]);
    expect((await admin.agent.get('/api/admin/products')).body.pagination.total).toBe(3); // admins see everything
  });

  it('paginates and filters by category slug, badge and flags', async () => {
    const other = await createCategory({ slug: 'mugs', name: 'Mugs' });
    for (let i = 0; i < 5; i++) await createProduct();
    await createProduct({ categoryId: other.id, name: 'Mug' });
    await prisma.product.updateMany({
      where: { name: 'Mug' },
      data: { isBestSeller: true, badge: 'LIMITED' },
    });

    const page = await request(server).get(
      '/api/products?category=test-category&page=2&pageSize=2',
    );
    expect(page.body.pagination).toEqual({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
    expect(page.body.data).toHaveLength(2);
    expect(
      (await request(server).get('/api/products?category=mugs')).body.data.map(
        (p: { name: string }) => p.name,
      ),
    ).toEqual(['Mug']);
    expect((await request(server).get('/api/products?bestSeller=true')).body.pagination.total).toBe(
      1,
    );
    expect((await request(server).get('/api/products?badge=LIMITED')).body.pagination.total).toBe(
      1,
    );
  });

  it('hard-deletes never-ordered products and soft-deletes ordered ones', async () => {
    const unused = await createProduct();
    const hard = await admin.agent.delete(`/api/admin/products/${unused.id}`);
    expect(hard.body.data).toEqual({ id: unused.id, mode: 'hard' });
    expect(await prisma.product.findUnique({ where: { id: unused.id } })).toBeNull();
    expect(await prisma.productVariant.count({ where: { productId: unused.id } })).toBe(0);

    const ordered = await createProduct();
    const customer = await loggedInUser(server);
    const placed = await customer.agent
      .post('/api/orders')
      .send({ items: [{ productId: ordered.id, size: 'M', quantity: 1 }] });
    expect(placed.status).toBe(201);

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
      .send({
        ...newJersey(),
        description: 'Keep me',
        lowStockThreshold: 9,
        isActive: false,
        tags: ['a'],
      });
    const id = created.body.data.id as string;

    const res = await admin.agent.patch(`/api/admin/products/${id}`).send({ priceCents: 100 });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      priceCents: 100,
      description: 'Keep me',
      images: newJersey().images,
      tags: ['a'],
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

  it('can move a product to another category', async () => {
    const other = await createCategory();
    const p = await createProduct();
    const res = await admin.agent
      .patch(`/api/admin/products/${p.id}`)
      .send({ categoryId: other.id });
    expect(res.body.data.category.id).toBe(other.id);
    expect(
      (await admin.agent.patch(`/api/admin/products/${p.id}`).send({ categoryId: 'missing' }))
        .status,
    ).toBe(400);
  });

  it('rejects an explicitly requested slug that is taken instead of silently changing it', async () => {
    const taken = await createProduct();
    const res = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey(), slug: taken.slug });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('SLUG_TAKEN');
    const other = await createProduct();
    expect(
      (await admin.agent.patch(`/api/admin/products/${other.id}`).send({ slug: taken.slug }))
        .status,
    ).toBe(409);
  });

  it('derives a unique slug from the name when none is given', async () => {
    const a = await admin.agent.post('/api/admin/products').send(newJersey());
    const b = await admin.agent
      .post('/api/admin/products')
      .send({ ...newJersey(), sku: 'JSY-OTHER' });
    expect(a.body.data.slug).toBe('home-jersey-26-27');
    expect(b.body.data.slug).toMatch(/^home-jersey-26-27-[0-9a-f]{6}$/);
  });
});

describe('per-size stock management', () => {
  it('adds stock, sets stock, and audits who did it — per size', async () => {
    const p = await createProduct({ sizes: { M: 10, L: 4 } });

    const add = await admin.agent
      .post(`/api/admin/products/${p.id}/stock`)
      .send({ size: 'M', change: 50, note: 'Delivery #42' });
    expect(add.status).toBe(200);
    expect(await stockOf(p.id, 'M')).toBe(60);
    expect(await stockOf(p.id, 'L')).toBe(4); // other sizes untouched

    const set = await admin.agent
      .post(`/api/admin/products/${p.id}/stock`)
      .send({ size: 'M', set: 120 });
    expect(set.body.data.sizes.find((s: { size: string }) => s.size === 'M').stockQuantity).toBe(
      120,
    );

    const log = await admin.agent.get(`/api/admin/inventory/movements?productId=${p.id}&size=M`);
    expect(
      log.body.data.map(
        (m: { size: string; change: number; reason: string; stockAfter: number }) => [
          m.size,
          m.change,
          m.reason,
          m.stockAfter,
        ],
      ),
    ).toEqual([
      ['M', 60, 'ADJUSTMENT', 120],
      ['M', 50, 'RESTOCK', 60],
    ]);
    expect(log.body.data[0].admin).toEqual({ id: admin.id, email: admin.email });
    expect(log.body.data[1].note).toBe('Delivery #42');
  });

  it('creates a size on demand, but never takes stock below zero', async () => {
    const p = await createProduct({ sizes: { M: 3 } });
    const created = await admin.agent
      .post(`/api/admin/products/${p.id}/stock`)
      .send({ size: 'XL', change: 12 });
    expect(created.status).toBe(200);
    expect(await stockOf(p.id, 'XL')).toBe(12);

    const neg = await admin.agent
      .post(`/api/admin/products/${p.id}/stock`)
      .send({ size: 'M', change: -5 });
    expect(neg.status).toBe(409);
    expect(neg.body.error.code).toBe('STOCK_WOULD_BE_NEGATIVE');
    // A failed request must not leave a phantom empty size behind.
    const phantom = await admin.agent
      .post(`/api/admin/products/${p.id}/stock`)
      .send({ size: 'XXL', change: -1 });
    expect(phantom.status).toBe(409);
    expect(await prisma.productVariant.count({ where: { productId: p.id, size: 'XXL' } })).toBe(0);

    expect(
      (
        await admin.agent
          .post(`/api/admin/products/${p.id}/stock`)
          .send({ size: 'M', change: 1, set: 4 })
      ).status,
    ).toBe(400);
    expect(
      (await admin.agent.post(`/api/admin/products/${p.id}/stock`).send({ size: 'M' })).status,
    ).toBe(400);
    expect(
      (await admin.agent.post(`/api/admin/products/${p.id}/stock`).send({ change: 1 })).status,
    ).toBe(400); // size required
  });

  it('emails admins when a size drops to the low-stock threshold', async () => {
    const p = await createProduct({ sizes: { M: 10 }, lowStockThreshold: 3 });
    await admin.agent.post(`/api/admin/products/${p.id}/stock`).send({ size: 'M', change: -7 });
    const alert = emailsTo(admin.email).find((m) => m.subject.startsWith('Low stock alert'));
    expect(alert).toBeDefined();
    expect(alert!.text).toContain('(M)');
  });

  it('shows the per-size inventory dashboard with low-stock rows and totals', async () => {
    const fine = await createProduct({ sizes: { M: 100, L: 100 }, lowStockThreshold: 5 });
    const low = await createProduct({ sizes: { M: 50, L: 2, XL: 0 }, lowStockThreshold: 5 });
    const res = await admin.agent.get('/api/admin/inventory?lowStockOnly=true');
    expect(res.status).toBe(200);
    expect(res.body.summary).toMatchObject({
      totalProducts: 2,
      totalUnitsInStock: 252,
      lowStockCount: 2,
      outOfStockCount: 1,
    });
    expect(
      res.body.data.map((r: { productId: string; size: string }) => [r.productId, r.size]),
    ).toEqual([
      [low.id, 'XL'],
      [low.id, 'L'],
    ]);
    const all = await admin.agent.get('/api/admin/inventory');
    expect(all.body.pagination.total).toBe(5);
    expect(
      all.body.data.every((r: { productId: string }) => [fine.id, low.id].includes(r.productId)),
    ).toBe(true);
  });
});
