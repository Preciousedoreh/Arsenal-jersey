import { cache } from 'react';
import { images } from '@/data/images';
import type { ApiCategory, ApiProduct, Paginated } from '@/types/api';
import type { Category, Product } from '@/types';
import { ApiError, api } from './api';

/** Storefront data is cached for this many seconds, so catalogue edits appear within about half a minute. */
const REVALIDATE_SECONDS = 30;
/** Largest page the API serves. */
const PAGE_SIZE = 100;

/** Placeholder tile art for the starter categories (used until an admin uploads a photo). */
const placeholderCategoryImage: Record<string, string> = {
  'home-kits': images.categories.home,
  'away-kits': images.categories.away,
  'third-kits': images.categories.third,
  retro: images.categories.retro,
  training: images.categories.training,
  'women-kids': images.categories.womenKids,
};

/** API product (cents) → storefront product (dollars). */
export function toProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    subtitle: p.subtitle ?? undefined,
    price: p.priceCents / 100,
    images: p.images,
    description: p.description,
    features: p.features,
    specs: p.specs,
    sku: p.sku,
    tags: p.tags,
    sizes: p.sizes.map((s) => ({ size: s.size, stock: s.stockQuantity })),
    stock: p.totalStock,
    customizable: p.isCustomizable,
    printPrice: p.printPriceCents / 100,
    printColor: p.printColor ?? undefined,
    colors: p.colorName && p.colorHex ? [{ name: p.colorName, hex: p.colorHex }] : [],
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount,
    badge: p.badge ?? undefined,
    isFeatured: p.isFeatured,
    isBestSeller: p.isBestSeller,
    category: p.category.slug,
    categoryName: p.category.name,
  };
}

export function toCategory(c: ApiCategory): Category {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    description: c.description,
    image: c.imageUrl ?? placeholderCategoryImage[c.slug],
    productCount: c.productCount,
  };
}

// `cache()` de-duplicates identical calls within one render (layout + page asking for the same thing).

export const getCategories = cache(async (): Promise<Category[]> => {
  const res = await api<{ data: ApiCategory[] }>('/api/categories', { revalidate: REVALIDATE_SECONDS });
  return res.data.map(toCategory);
});

export const getProducts = cache(async (categorySlug?: string): Promise<Product[]> => {
  const query = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
  if (categorySlug) query.set('category', categorySlug);
  const res = await api<Paginated<ApiProduct>>(`/api/products?${query}`, { revalidate: REVALIDATE_SECONDS });
  return res.data.map(toProduct);
});

/** `null` when the product doesn't exist (or isn't visible). */
export const getProductBySlug = cache(async (slug: string): Promise<Product | null> => {
  try {
    const res = await api<{ data: ApiProduct }>(`/api/products/${encodeURIComponent(slug)}`, { revalidate: REVALIDATE_SECONDS });
    return toProduct(res.data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

/** Same-category products first, then the rest, for "You may also like". */
export function relatedProducts(product: Product, all: Product[], count = 4): Product[] {
  const others = all.filter((p) => p.id !== product.id);
  return [...others.filter((p) => p.category === product.category), ...others.filter((p) => p.category !== product.category)].slice(0, count);
}
