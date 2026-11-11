import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { hashPassword } from 'better-auth/crypto';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { emailService, MemoryEmailService } from '../src/services/email/email.service.js';

export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'Sup3r-Secret-Passphrase!';

if (!(emailService instanceof MemoryEmailService))
  throw new Error('Tests require EMAIL_TRANSPORT=memory');
export const outbox = emailService;

/** One real HTTP server per test file, so concurrent requests really are concurrent. */
export function startServer(app: Express = createApp()): {
  server: Server;
  url: string;
  close: () => Promise<void>;
} {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** A cookie-keeping client that sends an allow-listed Origin (required for CSRF checks). */
export function client(server: Server) {
  return request.agent(server).set('Origin', ORIGIN);
}
export type Client = ReturnType<typeof client>;

export async function resetDb(): Promise<void> {
  if (!/_test\b/.test(process.env.DATABASE_URL ?? ''))
    throw new Error('resetDb() refused: not a test database');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "payments", "inventory_movements", "order_items", "orders", "products",
      "sessions", "accounts", "verifications", "login_lockouts", "users" RESTART IDENTITY CASCADE`);
  outbox.clear();
}

export const uniqueEmail = (prefix = 'user') => `${prefix}-${randomUUID().slice(0, 8)}@example.com`;

/** Inserts a user directly (fast path for tests that don't exercise sign-up itself). */
export async function createUser(
  opts: { role?: 'ADMIN' | 'CUSTOMER'; verified?: boolean; email?: string } = {},
) {
  const id = randomUUID();
  const email = opts.email ?? uniqueEmail(opts.role === 'ADMIN' ? 'admin' : 'customer');
  await prisma.user.create({
    data: {
      id,
      email,
      name: opts.role === 'ADMIN' ? 'Admin User' : 'Customer User',
      role: opts.role ?? 'CUSTOMER',
      emailVerified: opts.verified ?? true,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: 'credential',
          password: await hashPassword(PASSWORD),
        },
      },
    },
  });
  return { id, email };
}

export async function signIn(server: Server, email: string, password = PASSWORD): Promise<Client> {
  const agent = client(server);
  const res = await agent.post('/api/auth/sign-in/email').send({ email, password });
  if (res.status !== 200)
    throw new Error(`sign-in failed: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export async function loggedInUser(server: Server, opts: Parameters<typeof createUser>[0] = {}) {
  const user = await createUser(opts);
  return { ...user, agent: await signIn(server, user.email) };
}

export async function createProduct(
  overrides: Partial<{
    stockQuantity: number;
    lowStockThreshold: number;
    priceCents: number;
    name: string;
    isActive: boolean;
  }> = {},
) {
  const suffix = randomUUID().slice(0, 8);
  return prisma.product.create({
    data: {
      name: overrides.name ?? `Test Jersey ${suffix}`,
      slug: `test-jersey-${suffix}`,
      sku: `SKU-${suffix}`.toUpperCase(),
      category: 'JERSEY',
      priceCents: overrides.priceCents ?? 5000,
      currency: 'USD',
      stockQuantity: overrides.stockQuantity ?? 10,
      lowStockThreshold: overrides.lowStockThreshold ?? 2,
      isActive: overrides.isActive ?? true,
    },
  });
}

/** Extracts the first link containing `needle` from the latest email sent to `to`. */
export function linkFromEmail(to: string, needle: string): string {
  const mail = [...outbox.outbox]
    .reverse()
    .find((m) => m.to.includes(to) && m.text.includes(needle));
  if (!mail) throw new Error(`no email to ${to} containing ${needle}`);
  const match = mail.text.match(/https?:\/\/\S+/g)?.find((u) => u.includes(needle));
  if (!match) throw new Error('link not found in email');
  const url = new URL(match);
  return url.pathname + url.search;
}

export const emailsTo = (to: string) => outbox.outbox.filter((m) => m.to.includes(to));
