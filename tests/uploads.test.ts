import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { resolve } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { defaultCategory, loggedInUser, resetDb, startServer, type Client } from './helpers.js';

let srv: ReturnType<typeof startServer>;
let server: Server;
let admin: { agent: Client };

// A valid 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
const WEBP = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WEBP'),
  Buffer.alloc(32),
]);

beforeAll(() => {
  srv = startServer();
  server = srv.server;
});
afterAll(async () => {
  await srv.close();
  await rm(resolve(process.env.UPLOAD_DIR ?? 'uploads-test'), { recursive: true, force: true });
});
beforeEach(async () => {
  await resetDb();
  admin = await loggedInUser(server, { role: 'ADMIN' });
});

const upload = (
  agent: Client | ReturnType<typeof request>,
  file: Buffer,
  filename: string,
  contentType: string,
) => agent.post('/api/admin/uploads').attach('file', file, { filename, contentType });

describe('product photo uploads', () => {
  it('stores a PNG, serves it publicly (cross-origin allowed) and the URL is usable on a product', async () => {
    const res = await upload(admin.agent, PNG, 'front.png', 'image/png');
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ contentType: 'image/png', size: PNG.length });
    expect(res.body.data.key).toMatch(/^[0-9a-f-]{36}\.png$/);

    const path = new URL(res.body.data.url).pathname;
    expect(path).toBe(`/uploads/${res.body.data.key}`);
    const served = await request(server).get(path);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(served.body, PNG)).toBe(0);

    const category = await defaultCategory();
    const product = await admin.agent
      .post('/api/admin/products')
      .send({
        name: 'With Photo',
        categoryId: category.id,
        priceCents: 1000,
        sku: 'PHOTO-1',
        images: [res.body.data.url],
        sizes: [{ size: 'M', stockQuantity: 1 }],
      });
    expect(product.status).toBe(201);
    expect(product.body.data.images).toEqual([res.body.data.url]);
  });

  it('accepts JPEG and WebP and names files from the detected type, not the client filename', async () => {
    const jpg = await upload(admin.agent, JPEG, 'evil.php', 'application/x-php');
    expect(jpg.status).toBe(201);
    expect(jpg.body.data.key).toMatch(/\.jpg$/);
    const webp = await upload(admin.agent, WEBP, 'photo.png', 'image/png');
    expect(webp.status).toBe(201);
    expect(webp.body.data).toMatchObject({ contentType: 'image/webp' });
    expect(existsSync(resolve(process.env.UPLOAD_DIR ?? 'uploads-test', jpg.body.data.key))).toBe(
      true,
    );
  });

  it('rejects anything that is not a JPEG, PNG or WebP by content — including SVG and disguised files', async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    for (const [file, name, type] of [
      [svg, 'logo.png', 'image/png'], // SVG pretending to be a PNG
      [svg, 'logo.svg', 'image/svg+xml'],
      [Buffer.from('<?php echo 1; ?>'), 'shell.png', 'image/png'],
      [Buffer.from('just text'), 'notes.jpg', 'image/jpeg'],
    ] as const) {
      const res = await upload(admin.agent, file, name, type);
      expect(res.status, name).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    }
  });

  it('enforces the size limit and requires a file', async () => {
    const tooBig = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]); // limit is 1 MB in the test env
    const big = await upload(admin.agent, tooBig, 'big.png', 'image/png');
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('FILE_TOO_LARGE');

    const none = await admin.agent.post('/api/admin/uploads').field('note', 'no file here');
    expect(none.status).toBe(400);
  });

  it('is admin-only, and never serves files outside the upload folder', async () => {
    const customer = await loggedInUser(server);
    const anonymous = await request(server)
      .post('/api/admin/uploads')
      .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' });
    expect(anonymous.status).toBe(401);
    expect((await upload(customer.agent, PNG, 'a.png', 'image/png')).status).toBe(403);
    expect((await request(server).get('/uploads/../package.json')).status).toBe(404);
    expect((await request(server).get('/uploads/%2e%2e/package.json')).status).toBe(404);
  });
});
