/**
 * Seeds the first ADMIN (from ADMIN_EMAIL / ADMIN_PASSWORD), the shop's categories and a starter
 * catalogue with per-size stock. Idempotent: safe to run repeatedly, and it never overwrites a
 * category or product that already exists (so admin edits survive). There is deliberately no
 * public route to become an admin.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient, type ProductBadge, type Size } from '@prisma/client';
import { hashPassword } from 'better-auth/crypto';

const prisma = new PrismaClient();
const currency = process.env.STORE_CURRENCY ?? 'USD';
/** The starter catalogue's placeholder artwork is served by the storefront from /public/images. */
const assets = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '') + '/images';

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
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN', emailVerified: true } });
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
      accounts: { create: { id: randomUUID(), accountId: id, providerId: 'credential', password: await hashPassword(password) } },
    },
  });
  console.info(`created admin ${email}`);
}

const categories = [
  { slug: 'home-kits', name: 'Home Kits', sortOrder: 10, description: 'The red-and-white home shirts.' },
  { slug: 'away-kits', name: 'Away Kits', sortOrder: 20, description: 'Away-day shirts.' },
  { slug: 'third-kits', name: 'Third Kits', sortOrder: 30, description: 'Third and limited-edition shirts.' },
  { slug: 'retro', name: 'Retro', sortOrder: 40, description: 'Heritage reissues.' },
  { slug: 'training', name: 'Training', sortOrder: 50, description: 'Training and pre-match wear.' },
  { slug: 'women-kids', name: 'Women & Kids', sortOrder: 60, description: 'Women’s and kids’ kits.' },
];

async function seedCategories(): Promise<void> {
  let created = 0;
  for (const c of categories) {
    if (await prisma.category.findUnique({ where: { slug: c.slug } })) continue;
    await prisma.category.create({ data: { ...c, imageUrl: `${assets}/category-${c.slug}.svg` } });
    created++;
  }
  console.info(`categories: ${created} created, ${categories.length - created} already present`);
}

const SIZES: Size[] = ['S', 'M', 'L', 'XL', 'XXL'];

/** Spec rows shared by the knitted match shirts. */
const matchSpecs = (extra: { label: string; value: string }[] = []) => [
  { label: 'Fabric', value: '100% recycled polyester interlock' },
  { label: 'Fit', value: 'Regular — true to size' },
  { label: 'Neckline', value: 'Round, woven collar tape' },
  { label: 'Crest', value: 'Embroidered' },
  ...extra,
  { label: 'Care', value: 'Machine wash cold, inside out. Line dry. Do not iron the print.' },
  { label: 'Origin', value: 'Imported' },
];

const gallery = (kit: string) => [`${assets}/kit-${kit}.svg`, `${assets}/kit-${kit}-back.svg`, `${assets}/kit-${kit}-detail.svg`];

interface SeedProduct {
  name: string;
  slug: string;
  subtitle?: string;
  sku: string;
  category: string;
  priceCents: number;
  kit: string;
  description: string;
  features: string[];
  specs: { label: string; value: string }[];
  tags: string[];
  /** Stock for S, M, L, XL, XXL. */
  stock: number[];
  badge?: ProductBadge;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isCustomizable?: boolean;
  printColor?: string;
  colorName: string;
  colorHex: string;
  rating: number;
  reviewCount: number;
}

const products: SeedProduct[] = [
  {
    name: 'Home 26', slug: 'home-26', subtitle: '2026 Home Kit', sku: 'RL-HOME-2627', category: 'home-kits', priceCents: 8900, kit: 'home-26',
    description: 'The 2026/27 home shirt in the colours of the terraces: bold red body, clean white sleeves and gold crest detailing. A lightweight recycled knit with breathable mesh panels keeps you cool from the first whistle to the last.',
    features: ['100% recycled polyester, moisture-wicking', 'Breathable mesh back panels', 'Embroidered crest and woven collar tape', 'Add your own name & number'],
    specs: matchSpecs(), tags: ['Home', '2026/27', 'Match shirt'], stock: [8, 14, 14, 8, 4],
    badge: 'NEW', isFeatured: true, isBestSeller: true, isCustomizable: true, printColor: '#FFFFFF', colorName: 'Home Red', colorHex: '#EF0107', rating: 4.8, reviewCount: 412,
  },
  {
    name: 'Away 26', slug: 'away-26', subtitle: '2026 Away Kit', sku: 'RL-AWAY-2627', category: 'away-kits', priceCents: 8900, kit: 'away-26',
    description: 'Crisp off-white with red cuffs and gold side panels — the away shirt is made for travelling days. Same lightweight knit as the home kit, with a softer hand feel and a cooler look in the sun.',
    features: ['100% recycled polyester, quick-dry', 'Gold side panels and red cuff accents', 'Embroidered crest and woven collar tape', 'Add your own name & number'],
    specs: matchSpecs(), tags: ['Away', '2026/27', 'Match shirt'], stock: [5, 10, 9, 5, 2],
    badge: 'NEW', isCustomizable: true, printColor: '#EF0107', colorName: 'Away White', colorHex: '#F4F1EA', rating: 4.7, reviewCount: 268,
  },
  {
    name: 'Third 26', slug: 'third-26', subtitle: '2026 Third Kit', sku: 'RL-THIRD-2627', category: 'third-kits', priceCents: 9500, kit: 'third-26',
    description: 'Black as the night sky with fine gold chevrons across the chest. The third kit is the statement piece of the season, finished with a gold collar and cuffs.',
    features: ['100% recycled polyester, moisture-wicking', 'Tonal gold chevron graphic', 'Gold embroidered crest and collar tape', 'Add your own name & number'],
    specs: matchSpecs(), tags: ['Third', '2026/27', 'Match shirt'], stock: [1, 3, 3, 2, 0],
    badge: 'NEW', isCustomizable: true, printColor: '#D6B66E', colorName: 'Third Black', colorHex: '#0E0C0D', rating: 4.9, reviewCount: 187,
  },
  {
    name: 'Retro 1989 Shirt', slug: 'retro-1989-shirt', sku: 'RL-RETRO-1989', category: 'retro', priceCents: 7500, kit: 'retro-89',
    description: 'A heritage reissue in classic red and white. Soft, heavyweight cotton-feel fabric with a relaxed cut — made for the pub as much as the stands.',
    features: ['Heritage-style chevron pattern', 'Heavier, softer fabric than the match shirts', 'Relaxed retro fit', 'Embroidered chest crest'],
    specs: [
      { label: 'Fabric', value: '60% cotton, 40% recycled polyester' },
      { label: 'Fit', value: 'Relaxed — size down for a closer fit' },
      { label: 'Neckline', value: 'Round, ribbed collar' },
      { label: 'Care', value: 'Machine wash cold. Line dry.' },
      { label: 'Origin', value: 'Imported' },
    ],
    tags: ['Retro', 'Heritage'], stock: [3, 6, 7, 4, 2], isBestSeller: true, colorName: 'Red', colorHex: '#EF0107', rating: 4.9, reviewCount: 356,
  },
  {
    name: 'Training Top', slug: 'training-top', sku: 'RL-TRAIN-TOP', category: 'training', priceCents: 5500, kit: 'training-top',
    description: 'Deep red with a bold black sash, built for warm-ups and weekday sessions. Stretchy, quick-drying and light enough to forget you are wearing it.',
    features: ['Stretch knit for full range of motion', 'Quick-dry, moisture-wicking', 'Lightweight with flat seams', 'Chest crest'],
    specs: [
      { label: 'Fabric', value: '92% recycled polyester, 8% elastane' },
      { label: 'Fit', value: 'Athletic — true to size' },
      { label: 'Neckline', value: 'Round' },
      { label: 'Care', value: 'Machine wash cold. Do not tumble dry.' },
      { label: 'Origin', value: 'Imported' },
    ],
    tags: ['Training'], stock: [10, 16, 16, 12, 6], isBestSeller: true, colorName: 'Deep Red', colorHex: '#A80005', rating: 4.6, reviewCount: 143,
  },
  {
    name: 'Pre-Match Jersey', slug: 'pre-match-jersey', sku: 'RL-PREMATCH', category: 'training', priceCents: 6500, kit: 'pre-match',
    description: 'The warm-up shirt for the walk to the ground: white with red sleeves and a soft chevron print. Light, airy and easy to layer.',
    features: ['Soft chevron print', 'Lightweight, breathable knit', 'Contrast red sleeves', 'Chest crest'],
    specs: [
      { label: 'Fabric', value: '100% recycled polyester' },
      { label: 'Fit', value: 'Regular — true to size' },
      { label: 'Neckline', value: 'Round' },
      { label: 'Care', value: 'Machine wash cold. Line dry.' },
      { label: 'Origin', value: 'Imported' },
    ],
    tags: ['Training', 'Pre-match'], stock: [0, 2, 1, 1, 0], isBestSeller: true, colorName: 'White/Red', colorHex: '#FFFFFF', rating: 4.7, reviewCount: 98,
  },
  {
    name: 'Black & Gold Limited', slug: 'black-gold-limited', sku: 'RL-LTD-BLKGLD', category: 'third-kits', priceCents: 12000, kit: 'limited-edition',
    description: 'A limited black-and-gold collector’s shirt with fine gold pinstripes and gold trim. Produced in a small run and numbered by batch — when it’s gone, it’s gone.',
    features: ['Limited production run', 'Fine gold pinstripe knit', 'Gold embroidered crest, collar and cuffs', 'Presentation packaging'],
    specs: matchSpecs([{ label: 'Edition', value: 'Limited run, numbered by batch' }]),
    tags: ['Limited edition', '2026/27'], stock: [1, 2, 2, 2, 0], badge: 'LIMITED', colorName: 'Limited Gold', colorHex: '#9C824A', rating: 5, reviewCount: 61,
  },
];

async function seedProducts(): Promise<void> {
  const categoryIds = new Map((await prisma.category.findMany()).map((c) => [c.slug, c.id]));
  let created = 0;
  for (const p of products) {
    if (await prisma.product.findUnique({ where: { sku: p.sku } })) continue;
    const categoryId = categoryIds.get(p.category);
    if (!categoryId) throw new Error(`unknown category ${p.category}`);
    const product = await prisma.product.create({
      data: {
        name: p.name, slug: p.slug, subtitle: p.subtitle ?? null, sku: p.sku, categoryId, currency,
        priceCents: p.priceCents, description: p.description, images: gallery(p.kit), features: p.features, specs: p.specs, tags: p.tags,
        badge: p.badge ?? null, isFeatured: p.isFeatured ?? false, isBestSeller: p.isBestSeller ?? false,
        isCustomizable: p.isCustomizable ?? false, printColor: p.printColor ?? null,
        colorName: p.colorName, colorHex: p.colorHex, rating: p.rating, reviewCount: p.reviewCount,
        variants: { create: SIZES.map((size, i) => ({ size, stockQuantity: p.stock[i] ?? 0 })) },
      },
      include: { variants: true },
    });
    await prisma.inventoryMovement.createMany({
      data: product.variants
        .filter((v) => v.stockQuantity > 0)
        .map((v) => ({ productId: product.id, variantId: v.id, change: v.stockQuantity, stockAfter: v.stockQuantity, reason: 'RESTOCK' as const, note: 'Seed stock' })),
    });
    created++;
  }
  console.info(`products: ${created} created, ${products.length - created} already present`);
}

/** The first version of this seed shipped a different demo catalogue. Remove it (only if nobody ordered it). */
const LEGACY_DEMO_SKUS = ['JSY-HOME-2627', 'JSY-AWAY-2627', 'JSY-THRD-2627', 'JSY-GK-2627', 'JSY-RETRO-89', 'MER-SCARF', 'MER-BEANIE', 'MER-MUG', 'MER-BALL', 'MER-GYMBAG'];

async function removeLegacyDemo(): Promise<void> {
  const old = await prisma.product.findMany({ where: { sku: { in: LEGACY_DEMO_SKUS } }, select: { id: true } });
  let removed = 0;
  for (const { id } of old) {
    if ((await prisma.orderItem.count({ where: { productId: id } })) > 0) continue;
    await prisma.product.delete({ where: { id } });
    removed++;
  }
  // The migration's catch-all categories go too, once empty.
  const emptied = await prisma.category.deleteMany({ where: { slug: { in: ['jerseys', 'merchandise'] }, products: { none: {} } } });
  if (removed || emptied.count) console.info(`removed ${removed} legacy demo products and ${emptied.count} legacy categories`);
}

async function main(): Promise<void> {
  await seedAdmin();
  await seedCategories();
  await removeLegacyDemo();
  await seedProducts();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
