/**
 * Seeds the first ADMIN (from ADMIN_EMAIL / ADMIN_PASSWORD) and a sample catalogue.
 * Idempotent: safe to run repeatedly. There is deliberately no public route to become an admin.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient, type ProductCategory } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();
const currency = process.env.STORE_CURRENCY ?? 'USD';

async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'Store Admin';
  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin user — skipping.');
    return;
  }
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'ADMIN', emailVerified: true },
    });
    console.info(`admin ${email} already exists — ensured ADMIN role`);
    return;
  }

  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email,
      name,
      role: 'ADMIN',
      emailVerified: true,
      // Same scrypt hash format Better Auth uses for sign-up, so the admin can log in normally.
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: 'credential',
          password: await hashPassword(password),
        },
      },
    },
  });
  console.info(`created admin ${email}`);
}

interface SeedProduct {
  name: string;
  slug: string;
  sku: string;
  category: ProductCategory;
  priceCents: number;
  stockQuantity: number;
  lowStockThreshold: number;
  description: string;
}

const products: SeedProduct[] = [
  {
    name: 'Home Jersey 2026/27',
    slug: 'home-jersey-2026-27',
    sku: 'JSY-HOME-2627',
    category: 'JERSEY',
    priceCents: 8999,
    stockQuantity: 120,
    lowStockThreshold: 15,
    description: 'Official-style home shirt, breathable recycled polyester.',
  },
  {
    name: 'Away Jersey 2026/27',
    slug: 'away-jersey-2026-27',
    sku: 'JSY-AWAY-2627',
    category: 'JERSEY',
    priceCents: 8999,
    stockQuantity: 80,
    lowStockThreshold: 15,
    description: 'Away shirt with contrast trim.',
  },
  {
    name: 'Third Jersey 2026/27',
    slug: 'third-jersey-2026-27',
    sku: 'JSY-THRD-2627',
    category: 'JERSEY',
    priceCents: 8499,
    stockQuantity: 40,
    lowStockThreshold: 10,
    description: 'Limited third kit.',
  },
  {
    name: 'Goalkeeper Jersey 2026/27',
    slug: 'goalkeeper-jersey-2026-27',
    sku: 'JSY-GK-2627',
    category: 'JERSEY',
    priceCents: 7999,
    stockQuantity: 8,
    lowStockThreshold: 10,
    description: 'Padded-elbow keeper shirt.',
  },
  {
    name: 'Retro 1989 Jersey',
    slug: 'retro-1989-jersey',
    sku: 'JSY-RETRO-89',
    category: 'JERSEY',
    priceCents: 6999,
    stockQuantity: 25,
    lowStockThreshold: 5,
    description: 'Throwback classic.',
  },
  {
    name: 'Club Scarf',
    slug: 'club-scarf',
    sku: 'MER-SCARF',
    category: 'MERCHANDISE',
    priceCents: 1999,
    stockQuantity: 200,
    lowStockThreshold: 25,
    description: 'Knitted bar scarf.',
  },
  {
    name: 'Beanie Hat',
    slug: 'beanie-hat',
    sku: 'MER-BEANIE',
    category: 'MERCHANDISE',
    priceCents: 1599,
    stockQuantity: 150,
    lowStockThreshold: 20,
    description: 'Warm ribbed beanie.',
  },
  {
    name: 'Matchday Mug',
    slug: 'matchday-mug',
    sku: 'MER-MUG',
    category: 'MERCHANDISE',
    priceCents: 1299,
    stockQuantity: 60,
    lowStockThreshold: 10,
    description: 'Ceramic 350ml mug.',
  },
  {
    name: 'Training Football',
    slug: 'training-football',
    sku: 'MER-BALL',
    category: 'MERCHANDISE',
    priceCents: 2499,
    stockQuantity: 45,
    lowStockThreshold: 10,
    description: 'Size 5 training ball.',
  },
  {
    name: 'Drawstring Gym Bag',
    slug: 'drawstring-gym-bag',
    sku: 'MER-GYMBAG',
    category: 'MERCHANDISE',
    priceCents: 1499,
    stockQuantity: 3,
    lowStockThreshold: 5,
    description: 'Lightweight bag with crest.',
  },
];

async function seedProducts(): Promise<void> {
  let created = 0;
  for (const p of products) {
    const exists = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (exists) continue;
    await prisma.product.create({
      data: {
        ...p,
        currency,
        images: [],
        movements: {
          create: {
            change: p.stockQuantity,
            stockAfter: p.stockQuantity,
            reason: 'RESTOCK',
            note: 'Seed stock',
          },
        },
      },
    });
    created++;
  }
  console.info(`products: ${created} created, ${products.length - created} already present`);
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedProducts();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
