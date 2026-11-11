import type { Server } from 'node:http';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp, safeUrl } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import {
  client,
  createProduct,
  stockOf,
  createUser,
  emailsTo,
  linkFromEmail,
  loggedInUser,
  ORIGIN,
  PASSWORD,
  resetDb,
  signIn,
  startServer,
  uniqueEmail,
} from './helpers.js';

let srv: ReturnType<typeof startServer>;
let server: Server;

beforeAll(() => {
  srv = startServer();
  server = srv.server;
});
afterAll(() => srv.close());
beforeEach(resetDb);

describe('register → verify → login', () => {
  it('runs the full flow and blocks orders until the email is verified', async () => {
    const email = uniqueEmail('new');
    const agent = client(server);

    const signUp = await agent
      .post('/api/auth/sign-up/email')
      .send({ name: 'New Fan', email, password: PASSWORD });
    expect(signUp.status).toBe(200);
    expect(signUp.body.user.emailVerified).toBe(false);
    expect(signUp.body.user.role).toBe('CUSTOMER');
    expect(signUp.body.token).toBeUndefined(); // session token stays in the httpOnly cookie only
    expect(String(signUp.headers['set-cookie'])).toMatch(/HttpOnly/i);

    // A verification email was queued.
    expect(emailsTo(email).some((m) => m.subject.includes('Verify'))).toBe(true);

    // Unverified users can't place orders.
    const product = await createProduct();
    const blocked = await agent
      .post('/api/orders')
      .send({ items: [{ productId: product.id, size: 'M', quantity: 1 }] });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    // Click the link.
    const verify = await agent.get(linkFromEmail(email, 'verify-email'));
    expect([200, 302]).toContain(verify.status);

    // Log in fresh and confirm the account is verified.
    const fresh = await signIn(server, email);
    const me = await fresh.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ email, emailVerified: true, role: 'CUSTOMER' });

    const ordered = await fresh
      .post('/api/orders')
      .send({ items: [{ productId: product.id, size: 'M', quantity: 1 }] });
    expect(ordered.status).toBe(201);
  });

  it('ignores attempts to self-assign the ADMIN role on sign-up', async () => {
    const email = uniqueEmail('sneaky');
    const res = await client(server)
      .post('/api/auth/sign-up/email')
      .send({ name: 'Sneaky', email, password: PASSWORD, role: 'ADMIN' });
    expect(res.status).toBeGreaterThanOrEqual(200);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.role ?? 'CUSTOMER').toBe('CUSTOMER');
  });

  it('rejects short passwords', async () => {
    const res = await client(server)
      .post('/api/auth/sign-up/email')
      .send({ name: 'Short', email: uniqueEmail(), password: 'short' });
    expect(res.status).toBe(400);
  });

  it('does not put the session token in get-session responses', async () => {
    const { agent } = await loggedInUser(server);
    const res = await agent.get('/api/auth/get-session');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.session.token).toBeUndefined();
  });
});

describe('password reset & change', () => {
  it('returns the same generic response for known and unknown emails', async () => {
    const { email } = await createUser();
    const known = await client(server).post('/api/auth/request-password-reset').send({ email });
    const unknown = await client(server)
      .post('/api/auth/request-password-reset')
      .send({ email: uniqueEmail('ghost') });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('resets with a single-use token and revokes existing sessions', async () => {
    const { email, agent: oldSession } = await loggedInUser(server);
    expect((await oldSession.get('/api/me')).status).toBe(200);

    await client(server).post('/api/auth/request-password-reset').send({ email });
    const link = linkFromEmail(email, 'reset-password');
    const token = link.split('/reset-password/')[1]!.split('?')[0]!;

    const newPassword = 'Brand-New-Passphrase-77';
    const reset = await client(server)
      .post('/api/auth/reset-password')
      .send({ token, newPassword });
    expect(reset.status).toBe(200);

    // Old session revoked, old password gone, new password works.
    expect((await oldSession.get('/api/me')).status).toBe(401);
    expect(
      (await client(server).post('/api/auth/sign-in/email').send({ email, password: PASSWORD }))
        .status,
    ).toBe(401);
    await signIn(server, email, newPassword);

    // Token is single-use.
    const reuse = await client(server)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'Another-Passphrase-88' });
    expect(reuse.status).toBe(400);

    expect(emailsTo(email).some((m) => m.subject.includes('password was changed'))).toBe(true);
  });

  it('changes password only with the current password and notifies the user', async () => {
    const { email, agent } = await loggedInUser(server);
    const wrong = await agent
      .post('/api/auth/change-password')
      .send({ currentPassword: 'not-my-password', newPassword: 'Changed-Passphrase-55' });
    expect(wrong.status).toBe(400);

    const ok = await agent.post('/api/auth/change-password').send({
      currentPassword: PASSWORD,
      newPassword: 'Changed-Passphrase-55',
      revokeOtherSessions: true,
    });
    expect(ok.status).toBe(200);
    expect(emailsTo(email).some((m) => m.subject.includes('password was changed'))).toBe(true);
    await signIn(server, email, 'Changed-Passphrase-55');
  });
});

describe('sessions', () => {
  it('forwards the refreshed session cookie from API routes when the session slides', async () => {
    const { id, agent } = await loggedInUser(server);
    // Make the session look 6 days old (expires in 1 day) so Better Auth extends it.
    await prisma.session.updateMany({
      where: { userId: id },
      data: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
    });
    const res = await agent.get('/api/me');
    expect(res.status).toBe(200);
    expect(String(res.headers['set-cookie'])).toMatch(/session_token=/);
    const session = await prisma.session.findFirstOrThrow({ where: { userId: id } });
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it('does not return a session token from change-password', async () => {
    const { agent } = await loggedInUser(server);
    const res = await agent.post('/api/auth/change-password').send({
      currentPassword: PASSWORD,
      newPassword: 'Changed-Passphrase-66',
      revokeOtherSessions: true,
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect((await agent.get('/api/me')).status).toBe(200); // cookie was still rotated
  });

  it('masks tokens in logged URLs', () => {
    expect(safeUrl('/api/auth/reset-password/abc123?callbackURL=/x')).toBe(
      '/api/auth/reset-password/[redacted]',
    );
    expect(safeUrl('/api/auth/verify-email?token=secret')).toBe('/api/auth/verify-email');
    expect(safeUrl('/api/products/home-jersey')).toBe('/api/products/home-jersey');
  });

  it('logs out of all devices', async () => {
    const { email, agent: laptop } = await loggedInUser(server);
    const phone = await signIn(server, email);
    expect((await phone.get('/api/me')).status).toBe(200);

    const res = await laptop.post('/api/auth/revoke-sessions').send({});
    expect(res.status).toBe(200);
    expect((await laptop.get('/api/me')).status).toBe(401);
    expect((await phone.get('/api/me')).status).toBe(401);
  });

  it('signs out the current session', async () => {
    const { agent } = await loggedInUser(server);
    expect((await agent.post('/api/auth/sign-out').send({})).status).toBe(200);
    expect((await agent.get('/api/me')).status).toBe(401);
  });
});

describe('brute-force protection', () => {
  it('rate limits sign-in per IP + email with 429 and Retry-After', async () => {
    const { email } = await createUser();
    for (let i = 0; i < 5; i++) {
      const res = await client(server)
        .post('/api/auth/sign-in/email')
        .send({ email, password: 'wrong-password' });
      expect(res.status).toBe(401);
    }
    const limited = await client(server)
      .post('/api/auth/sign-in/email')
      .send({ email, password: PASSWORD });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);

    // A different email from the same IP is unaffected.
    const other = await createUser();
    await signIn(server, other.email);
  });

  it('locks the account after repeated failures from many IPs and emails the owner', async () => {
    // Trust X-Forwarded-For in this app instance so we can simulate a distributed attack.
    const app = createApp();
    app.set('trust proxy', true);
    const proxied = startServer(app);
    try {
      const { email } = await createUser();
      const threshold = Number(process.env.LOCKOUT_THRESHOLD);
      for (let i = 0; i < threshold; i++) {
        const res = await request(proxied.server)
          .post('/api/auth/sign-in/email')
          .set('Origin', ORIGIN)
          .set('X-Forwarded-For', `10.0.0.${i + 1}`)
          .send({ email, password: 'wrong-password' });
        expect(res.status).toBe(401);
      }

      // Even the correct password is now refused.
      const locked = await request(proxied.server)
        .post('/api/auth/sign-in/email')
        .set('Origin', ORIGIN)
        .set('X-Forwarded-For', '10.0.1.1')
        .send({ email, password: PASSWORD });
      expect(locked.status).toBe(429);
      expect(locked.body.code).toBe('ACCOUNT_LOCKED');
      expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
      expect(emailsTo(email).some((m) => m.subject.includes('temporarily locked'))).toBe(true);
    } finally {
      await proxied.close();
    }
  });
});

describe('authorization & CSRF', () => {
  it('rejects anonymous users with 401 and customers on admin routes with 403', async () => {
    expect((await request(server).get('/api/admin/products')).status).toBe(401);
    const { agent } = await loggedInUser(server, { role: 'CUSTOMER' });
    const res = await agent.get('/api/admin/products');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect((await agent.post('/api/admin/products').send({})).status).toBe(403);
    expect((await agent.get('/api/admin/users')).status).toBe(403);
  });

  it('rejects cookie-authenticated writes from a foreign origin', async () => {
    const { agent } = await loggedInUser(server);
    const product = await createProduct();
    const res = await agent
      .post('/api/orders')
      .set('Origin', 'https://evil.example')
      .send({ items: [{ productId: product.id, size: 'M', quantity: 1 }] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_ORIGIN_REJECTED');
    expect(await stockOf(product.id)).toBe(10);
  });

  it('lets admins change roles but never their own', async () => {
    const admin = await loggedInUser(server, { role: 'ADMIN' });
    const customer = await createUser();
    const promote = await admin.agent
      .patch(`/api/admin/users/${customer.id}/role`)
      .send({ role: 'ADMIN' });
    expect(promote.status).toBe(200);
    expect(promote.body.data.role).toBe('ADMIN');
    const self = await admin.agent
      .patch(`/api/admin/users/${admin.id}/role`)
      .send({ role: 'CUSTOMER' });
    expect(self.status).toBe(409);
  });
});

describe('errors', () => {
  it('uses the standard error shape', async () => {
    const res = await request(server).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'ROUTE_NOT_FOUND', message: expect.any(String) } });

    const bad = await request(server).get('/api/products?page=0');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('VALIDATION_ERROR');
    expect(bad.body.error.details[0].path).toBe('page');
  });

  it('reports health', async () => {
    const res = await request(server).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.checks.database).toBe('up');
  });
});
