import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCategory,
  createProduct,
  loggedInUser,
  resetDb,
  startServer,
  type Client,
} from './helpers.js';

let srv: ReturnType<typeof startServer>;
let server: Server;
let admin: { id: string; agent: Client };

beforeAll(() => {
  srv = startServer();
  server = srv.server;
});
afterAll(() => srv.close());
beforeEach(async () => {
  await resetDb();
  admin = await loggedInUser(server, { role: 'ADMIN' });
});

describe('public categories', () => {
  it('lists only active categories, in sort order, counting only purchasable products', async () => {
    const second = await createCategory({ name: 'Second', slug: 'second' });
    const first = await createCategory({ name: 'First', slug: 'first' });
    await createCategory({ name: 'Hidden', isActive: false });
    await admin.agent.patch(`/api/admin/categories/${second.id}`).send({ sortOrder: 20 });
    await admin.agent.patch(`/api/admin/categories/${first.id}`).send({ sortOrder: 10 });
    await createProduct({ categoryId: first.id });
    await createProduct({ categoryId: first.id, isActive: false }); // not counted publicly

    const res = await request(server).get('/api/categories');
    expect(res.status).toBe(200);
    expect(
      res.body.data.map((c: { slug: string; productCount: number }) => [c.slug, c.productCount]),
    ).toEqual([
      ['first', 1],
      ['second', 0],
    ]);
  });
});

describe('admin category management', () => {
  it('creates (slug from the name), updates, hides and lists categories', async () => {
    const created = await admin.agent
      .post('/api/admin/categories')
      .send({ name: 'Women & Kids', description: 'Smaller sizes', sortOrder: 5 });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      slug: 'women-kids',
      name: 'Women & Kids',
      isActive: true,
      sortOrder: 5,
      productCount: 0,
    });

    const id = created.body.data.id as string;
    const renamed = await admin.agent
      .patch(`/api/admin/categories/${id}`)
      .send({ name: 'Women and Kids', isActive: false });
    expect(renamed.body.data).toMatchObject({
      name: 'Women and Kids',
      isActive: false,
      slug: 'women-kids',
      sortOrder: 5,
    });

    const all = await admin.agent.get('/api/admin/categories');
    expect(all.body.data.map((c: { slug: string }) => c.slug)).toContain('women-kids'); // admins also see hidden ones
    expect((await request(server).get('/api/categories')).body.data).toHaveLength(0);
  });

  it('rejects duplicate slugs and invalid input', async () => {
    await admin.agent.post('/api/admin/categories').send({ name: 'Retro', slug: 'retro' });
    const dup = await admin.agent
      .post('/api/admin/categories')
      .send({ name: 'Retro 2', slug: 'retro' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SLUG_TAKEN');
    expect((await admin.agent.post('/api/admin/categories').send({ name: 'x' })).status).toBe(400);
    expect(
      (
        await admin.agent
          .post('/api/admin/categories')
          .send({ name: 'Fine', imageUrl: 'javascript:alert(1)' })
      ).status,
    ).toBe(400);
  });

  it('deletes an empty category but refuses while products belong to it', async () => {
    const full = await createCategory();
    await createProduct({ categoryId: full.id });
    const refused = await admin.agent.delete(`/api/admin/categories/${full.id}`);
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('CATEGORY_NOT_EMPTY');

    const empty = await createCategory();
    expect((await admin.agent.delete(`/api/admin/categories/${empty.id}`)).body.data).toEqual({
      id: empty.id,
    });
    expect((await admin.agent.delete(`/api/admin/categories/${empty.id}`)).status).toBe(404);
  });

  it('is admin-only', async () => {
    const customer = await loggedInUser(server);
    expect((await request(server).get('/api/admin/categories')).status).toBe(401);
    expect((await customer.agent.get('/api/admin/categories')).status).toBe(403);
    expect(
      (await customer.agent.post('/api/admin/categories').send({ name: 'Sneaky' })).status,
    ).toBe(403);
  });
});
