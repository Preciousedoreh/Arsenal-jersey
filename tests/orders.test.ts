import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { signMockPayload } from '../src/services/payment/payment.service.js';
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
let customer: { id: string; email: string; agent: Client };

beforeAll(() => {
  srv = startServer();
  server = srv.server;
});
afterAll(() => srv.close());
beforeEach(async () => {
  await resetDb();
  admin = await loggedInUser(server, { role: 'ADMIN' });
  customer = await loggedInUser(server, { role: 'CUSTOMER' });
});

const stockOf = async (id: string) =>
  (await prisma.product.findUniqueOrThrow({ where: { id } })).stockQuantity;
const order = (agent: Client, items: { productId: string; quantity: number }[]) =>
  agent.post('/api/orders').send({ items });

describe('placing orders', () => {
  it('deducts stock, snapshots prices, logs movements and sends emails', async () => {
    const jersey = await createProduct({ stockQuantity: 10, priceCents: 8999 });
    const scarf = await createProduct({ stockQuantity: 5, priceCents: 1999 });

    const res = await customer.agent.post('/api/orders').send({
      items: [
        { productId: jersey.id, quantity: 2 },
        { productId: scarf.id, quantity: 1 },
        { productId: jersey.id, quantity: 1 }, // duplicates are merged
      ],
      shippingAddress: {
        fullName: 'Fan One',
        line1: '1 Highbury Hill',
        city: 'London',
        country: 'gb',
      },
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      status: 'PENDING',
      currency: 'USD',
      totalCents: 3 * 8999 + 1999,
    });
    expect(res.body.data.shippingAddress.country).toBe('GB');
    expect(res.body.data.items).toHaveLength(2);

    expect(await stockOf(jersey.id)).toBe(7);
    expect(await stockOf(scarf.id)).toBe(4);

    // Price snapshot survives later price changes.
    await prisma.product.update({ where: { id: jersey.id }, data: { priceCents: 1 } });
    const fetched = await customer.agent.get(`/api/orders/${res.body.data.id}`);
    const jerseyLine = fetched.body.data.items.find(
      (i: { productId: string }) => i.productId === jersey.id,
    );
    expect(jerseyLine).toMatchObject({
      unitPriceCents: 8999,
      quantity: 3,
      lineTotalCents: 26997,
      productName: jersey.name,
    });

    const movements = await prisma.inventoryMovement.findMany({
      where: { orderId: res.body.data.id },
      orderBy: { change: 'asc' },
    });
    expect(movements.map((m) => [m.change, m.reason, m.stockAfter])).toEqual([
      [-3, 'ORDER', 7],
      [-1, 'ORDER', 4],
    ]);

    expect(emailsTo(customer.email).some((m) => m.subject.startsWith('Order confirmed'))).toBe(
      true,
    );
    expect(emailsTo(admin.email).some((m) => m.subject.startsWith('New order'))).toBe(true);
  });

  it('rolls back everything with 409 when any item is short on stock', async () => {
    const plenty = await createProduct({ stockQuantity: 10 });
    const scarce = await createProduct({ stockQuantity: 1, name: 'Scarce Jersey' });

    const res = await order(customer.agent, [
      { productId: plenty.id, quantity: 2 },
      { productId: scarce.id, quantity: 2 },
    ]);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      details: { productId: scarce.id, productName: 'Scarce Jersey', requested: 2, available: 1 },
    });

    expect(await stockOf(plenty.id)).toBe(10); // the first line's deduction was rolled back
    expect(await stockOf(scarce.id)).toBe(1);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.inventoryMovement.count({ where: { reason: 'ORDER' } })).toBe(0);
  });

  it('rejects inactive and unknown products', async () => {
    const inactive = await createProduct({ isActive: false });
    expect((await order(customer.agent, [{ productId: inactive.id, quantity: 1 }])).status).toBe(
      409,
    );
    expect(
      (await order(customer.agent, [{ productId: 'does-not-exist', quantity: 1 }])).status,
    ).toBe(404);
    expect((await order(customer.agent, [])).status).toBe(400);
  });

  it('never oversells under heavy concurrency', async () => {
    const STOCK = 10;
    const ATTEMPTS = 40;
    const product = await createProduct({ stockQuantity: STOCK, lowStockThreshold: 0 });

    // Several customers hammer the same product at once.
    const buyers = await Promise.all([
      customer,
      ...(await Promise.all([1, 2, 3].map(() => loggedInUser(server)))),
    ]);
    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, (_, i) =>
        order(buyers[i % buyers.length]!.agent, [{ productId: product.id, quantity: 1 }]),
      ),
    );

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(STOCK);
    expect(statuses.filter((s) => s === 409)).toHaveLength(ATTEMPTS - STOCK);
    expect(statuses.every((s) => s === 201 || s === 409)).toBe(true);

    expect(await stockOf(product.id)).toBe(0);
    const sold = await prisma.orderItem.aggregate({
      where: { productId: product.id },
      _sum: { quantity: true },
    });
    expect(sold._sum.quantity).toBe(STOCK);
    const moved = await prisma.inventoryMovement.aggregate({
      where: { productId: product.id, reason: 'ORDER' },
      _sum: { change: true },
    });
    expect(moved._sum.change).toBe(-STOCK);
  });

  it('never oversells with mixed quantities in parallel', async () => {
    const product = await createProduct({ stockQuantity: 7, lowStockThreshold: 0 });
    const results = await Promise.all(
      [3, 3, 3, 2, 2, 1, 1, 1].map((quantity) =>
        order(customer.agent, [{ productId: product.id, quantity }]),
      ),
    );
    const soldUnits = results
      .map((r, i) => (r.status === 201 ? [3, 3, 3, 2, 2, 1, 1, 1][i]! : 0))
      .reduce((a, b) => a + b, 0);
    const stock = await stockOf(product.id);
    expect(stock).toBeGreaterThanOrEqual(0);
    expect(soldUnits + stock).toBe(7);
  });

  it('emails admins once when stock crosses the low-stock threshold', async () => {
    const product = await createProduct({ stockQuantity: 6, lowStockThreshold: 4 });
    await order(customer.agent, [{ productId: product.id, quantity: 1 }]); // 5 — still above
    expect(
      emailsTo(admin.email).filter((m) => m.subject.startsWith('Low stock alert')),
    ).toHaveLength(0);
    await order(customer.agent, [{ productId: product.id, quantity: 1 }]); // 4 — crosses
    await order(customer.agent, [{ productId: product.id, quantity: 1 }]); // 3 — already low
    const alerts = emailsTo(admin.email).filter((m) => m.subject.startsWith('Low stock alert'));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.text).toContain(product.sku);
  });
});

describe('viewing orders', () => {
  it("lists only the customer's own orders and hides others' with 404", async () => {
    const p = await createProduct();
    const mine = await order(customer.agent, [{ productId: p.id, quantity: 1 }]);
    const other = await loggedInUser(server);
    const theirs = await order(other.agent, [{ productId: p.id, quantity: 1 }]);

    const list = await customer.agent.get('/api/orders');
    expect(list.body.data.map((o: { id: string }) => o.id)).toEqual([mine.body.data.id]);
    expect((await customer.agent.get(`/api/orders/${theirs.body.data.id}`)).status).toBe(404);

    const adminList = await admin.agent.get('/api/admin/orders?status=PENDING');
    expect(adminList.body.pagination.total).toBe(2);
    expect(adminList.body.data[0].customer.email).toBeDefined();
  });
});

describe('cancellation', () => {
  it('lets a customer cancel a PENDING order and restores stock', async () => {
    const p = await createProduct({ stockQuantity: 5 });
    const placed = await order(customer.agent, [{ productId: p.id, quantity: 3 }]);
    expect(await stockOf(p.id)).toBe(2);

    const cancel = await customer.agent
      .post(`/api/orders/${placed.body.data.id}/cancel`)
      .send({ reason: 'Changed my mind' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data).toMatchObject({
      status: 'CANCELLED',
      cancelReason: 'Changed my mind',
    });
    expect(await stockOf(p.id)).toBe(5);

    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { orderId: placed.body.data.id, reason: 'CANCEL' },
    });
    expect(movement).toMatchObject({ change: 3, stockAfter: 5 });
    expect(emailsTo(customer.email).some((m) => m.subject.includes('is now cancelled'))).toBe(true);

    // Cancelling twice doesn't restore stock twice.
    const again = await customer.agent.post(`/api/orders/${placed.body.data.id}/cancel`).send({});
    expect(again.status).toBe(409);
    expect(await stockOf(p.id)).toBe(5);
  });

  it('restores stock exactly once when cancellations race', async () => {
    const p = await createProduct({ stockQuantity: 5 });
    const placed = await order(customer.agent, [{ productId: p.id, quantity: 2 }]);
    const id = placed.body.data.id as string;
    const results = await Promise.all([
      customer.agent.post(`/api/orders/${id}/cancel`).send({}),
      customer.agent.post(`/api/orders/${id}/cancel`).send({}),
      admin.agent.patch(`/api/admin/orders/${id}/status`).send({ status: 'CANCELLED' }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await stockOf(p.id)).toBe(5);
  });

  it('stops customers cancelling once paid, but admins can until shipped', async () => {
    const p = await createProduct({ stockQuantity: 5 });
    const placed = await order(customer.agent, [{ productId: p.id, quantity: 1 }]);
    const id = placed.body.data.id as string;

    expect(
      (await admin.agent.patch(`/api/admin/orders/${id}/status`).send({ status: 'PAID' })).status,
    ).toBe(200);
    const denied = await customer.agent.post(`/api/orders/${id}/cancel`).send({});
    expect(denied.status).toBe(409);
    expect(denied.body.error.code).toBe('ORDER_NOT_CANCELLABLE');

    const byAdmin = await admin.agent
      .patch(`/api/admin/orders/${id}/status`)
      .send({ status: 'CANCELLED', note: 'Out of print' });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.data.status).toBe('CANCELLED');
    expect(await stockOf(p.id)).toBe(5);
  });

  it('does not allow cancelling a shipped order', async () => {
    const p = await createProduct({ stockQuantity: 5 });
    const id = (await order(customer.agent, [{ productId: p.id, quantity: 1 }])).body.data
      .id as string;
    for (const status of ['PAID', 'PROCESSING', 'SHIPPED']) {
      expect(
        (await admin.agent.patch(`/api/admin/orders/${id}/status`).send({ status })).status,
      ).toBe(200);
    }
    const res = await admin.agent
      .patch(`/api/admin/orders/${id}/status`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(409);
    expect(await stockOf(p.id)).toBe(4);
  });
});

describe('admin status workflow', () => {
  it('moves through the lifecycle, stamps timestamps, and emails the customer', async () => {
    const p = await createProduct();
    const id = (await order(customer.agent, [{ productId: p.id, quantity: 1 }])).body.data
      .id as string;

    const skip = await admin.agent
      .patch(`/api/admin/orders/${id}/status`)
      .send({ status: 'SHIPPED' });
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    for (const status of ['PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED']) {
      const res = await admin.agent.patch(`/api/admin/orders/${id}/status`).send({ status });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }
    const final = await admin.agent.get(`/api/admin/orders/${id}`);
    expect(final.body.data.paidAt).not.toBeNull();
    expect(final.body.data.shippedAt).not.toBeNull();
    expect(final.body.data.deliveredAt).not.toBeNull();
    expect(emailsTo(customer.email).some((m) => m.subject.includes('is now shipped'))).toBe(true);
  });
});

describe('payments (mock provider)', () => {
  const webhook = (payload: object, signature?: string) => {
    const raw = JSON.stringify(payload);
    return request(server)
      .post('/api/payments/webhook/mock')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', signature ?? signMockPayload(raw))
      .send(raw);
  };

  it('marks the order PAID from a signed webhook, idempotently', async () => {
    const p = await createProduct({ priceCents: 2500 });
    const id = (await order(customer.agent, [{ productId: p.id, quantity: 2 }])).body.data
      .id as string;
    const pay = await customer.agent.post(`/api/orders/${id}/pay`).send({});
    expect(pay.status).toBe(200);
    const { reference } = pay.body.data;

    const event = { type: 'payment.succeeded', reference, amountCents: 5000, currency: 'USD' };
    expect((await webhook(event, 'deadbeef')).status).toBe(400); // bad signature
    expect((await webhook({ ...event, amountCents: 1 })).status).toBe(400); // amount mismatch

    const ok = await webhook(event);
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('PAID');
    expect((await webhook(event)).status).toBe(200); // replay is harmless

    const fetched = await customer.agent.get(`/api/orders/${id}`);
    expect(fetched.body.data.status).toBe('PAID');
    expect(fetched.body.data.paidAt).not.toBeNull();
  });
});

describe('payment edge cases', () => {
  const succeed = (reference: string, amountCents: number) => {
    const raw = JSON.stringify({
      type: 'payment.succeeded',
      reference,
      amountCents,
      currency: 'USD',
    });
    return request(server)
      .post('/api/payments/webhook/mock')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', signMockPayload(raw))
      .send(raw);
  };
  const paymentStatus = async (reference: string) =>
    (await prisma.payment.findUniqueOrThrow({ where: { reference } })).status;

  async function pendingOrder(priceCents = 1000) {
    const p = await createProduct({ priceCents, stockQuantity: 5 });
    const res = await order(customer.agent, [{ productId: p.id, quantity: 1 }]);
    return { id: res.body.data.id as string, productId: p.id };
  }
  const startPayment = async (id: string) =>
    (await customer.agent.post(`/api/orders/${id}/pay`).send({})).body.data.reference as string;

  it('accepts a webhook for an earlier attempt when "pay" was clicked twice, and refunds a double payment', async () => {
    const { id } = await pendingOrder();
    const first = await startPayment(id);
    const second = await startPayment(id);

    const res = await succeed(first, 1000);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('PAID');
    expect((await admin.agent.get(`/api/admin/orders/${id}`)).body.data.paymentReference).toBe(
      first,
    );

    // The customer also completed the second checkout: that money goes back.
    const dup = await succeed(second, 1000);
    expect(dup.status).toBe(200);
    expect(dup.body.data.refunded).toBe(true);
    expect(await paymentStatus(first)).toBe('SUCCEEDED');
    expect(await paymentStatus(second)).toBe('REFUNDED');
  });

  it('refunds a payment that lands after the order was cancelled', async () => {
    const { id, productId } = await pendingOrder();
    const reference = await startPayment(id);
    expect((await customer.agent.post(`/api/orders/${id}/cancel`).send({})).status).toBe(200);

    const res = await succeed(reference, 1000);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'CANCELLED', refunded: true });
    expect(await paymentStatus(reference)).toBe('REFUNDED');
    expect(await stockOf(productId)).toBe(5);
  });

  it('refunds when an admin cancels a paid order', async () => {
    const { id } = await pendingOrder();
    const reference = await startPayment(id);
    await succeed(reference, 1000);
    const res = await admin.agent
      .patch(`/api/admin/orders/${id}/status`)
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(await paymentStatus(reference)).toBe('REFUNDED');
    expect(
      emailsTo(customer.email).some((m) => m.text.includes('changed from paid to cancelled')),
    ).toBe(true);
  });

  it('links (does not refund) a payment for an order an admin already marked paid by hand', async () => {
    const { id } = await pendingOrder();
    const reference = await startPayment(id);
    expect(
      (await admin.agent.patch(`/api/admin/orders/${id}/status`).send({ status: 'PAID' })).status,
    ).toBe(200);

    const res = await succeed(reference, 1000);
    expect(res.status).toBe(200);
    expect(res.body.data.refunded).toBeUndefined();
    expect(await paymentStatus(reference)).toBe('SUCCEEDED');
    expect((await admin.agent.get(`/api/admin/orders/${id}`)).body.data.paymentReference).toBe(
      reference,
    );
  });
});

describe('admin order filters', () => {
  it('treats a date-only "to" as the end of that day', async () => {
    const p = await createProduct();
    await order(customer.agent, [{ productId: p.id, quantity: 1 }]);
    const today = new Date().toISOString().slice(0, 10);
    const res = await admin.agent.get(`/api/admin/orders?from=${today}&to=${today}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(1);
  });
});
