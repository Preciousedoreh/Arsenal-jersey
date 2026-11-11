-- Catalogue upgrade: categories table, richer product fields, and stock tracked per size.
-- Written by hand to PRESERVE existing data (Prisma's generated version would drop it):
--   * old enum categories  -> two "legacy" categories (Jerseys, Merchandise), renameable in the admin
--   * old single stock     -> one variant per product (size M for jerseys, OS "one size" for merchandise)
--   * existing order lines / inventory movements are re-pointed at that variant

-- CreateEnum
CREATE TYPE "ProductBadge" AS ENUM ('NEW', 'LIMITED');
CREATE TYPE "Size" AS ENUM ('S', 'M', 'L', 'XL', 'XXL', 'OS');

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" "Size" NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_variants_productId_size_key" ON "product_variants"("productId", "size");
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Products: new columns (categoryId nullable until backfilled)
ALTER TABLE "products"
  ADD COLUMN "badge" "ProductBadge",
  ADD COLUMN "categoryId" TEXT,
  ADD COLUMN "colorHex" TEXT,
  ADD COLUMN "colorName" TEXT,
  ADD COLUMN "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "isBestSeller" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isCustomizable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "printColor" TEXT,
  ADD COLUMN "printPriceCents" INTEGER NOT NULL DEFAULT 1500,
  ADD COLUMN "rating" DOUBLE PRECISION,
  ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "specs" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "subtitle" TEXT,
  ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: legacy categories
INSERT INTO "categories" ("id", "slug", "name", "sortOrder", "updatedAt") VALUES
  ('cat_legacy_jerseys', 'jerseys', 'Jerseys', 900, CURRENT_TIMESTAMP),
  ('cat_legacy_merchandise', 'merchandise', 'Merchandise', 910, CURRENT_TIMESTAMP);

UPDATE "products" SET "categoryId" = CASE "category"::text WHEN 'JERSEY' THEN 'cat_legacy_jerseys' ELSE 'cat_legacy_merchandise' END;

-- Backfill: one variant per existing product, carrying the old stock figure
INSERT INTO "product_variants" ("id", "productId", "size", "stockQuantity", "updatedAt")
SELECT 'var_' || "id", "id", (CASE "category"::text WHEN 'JERSEY' THEN 'M' ELSE 'OS' END)::"Size", "stockQuantity", CURRENT_TIMESTAMP FROM "products";

-- Order lines: size + variant (nullable -> backfill -> NOT NULL)
ALTER TABLE "order_items" ADD COLUMN "customization" JSONB, ADD COLUMN "size" "Size", ADD COLUMN "variantId" TEXT;
UPDATE "order_items" oi SET "variantId" = v."id", "size" = v."size" FROM "product_variants" v WHERE v."productId" = oi."productId";
ALTER TABLE "order_items" ALTER COLUMN "size" SET NOT NULL, ALTER COLUMN "variantId" SET NOT NULL;

-- Inventory movements: variant
ALTER TABLE "inventory_movements" ADD COLUMN "variantId" TEXT;
UPDATE "inventory_movements" m SET "variantId" = v."id" FROM "product_variants" v WHERE v."productId" = m."productId";
ALTER TABLE "inventory_movements" ALTER COLUMN "variantId" SET NOT NULL;

-- Products: finish (dropping the old columns also drops their CHECK constraint and index)
ALTER TABLE "products" ALTER COLUMN "categoryId" SET NOT NULL;
DROP INDEX "products_category_isActive_idx";
ALTER TABLE "products" DROP COLUMN "category", DROP COLUMN "stockQuantity";
DROP TYPE "ProductCategory";

-- Indexes & foreign keys
CREATE INDEX "inventory_movements_variantId_createdAt_idx" ON "inventory_movements"("variantId", "createdAt");
CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");
CREATE INDEX "products_categoryId_isActive_idx" ON "products"("categoryId", "isActive");
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integrity guards (defence in depth): per-size stock can never go negative even if application logic is wrong.
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_stock_non_negative" CHECK ("stockQuantity" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_print_price_non_negative" CHECK ("printPriceCents" >= 0);
