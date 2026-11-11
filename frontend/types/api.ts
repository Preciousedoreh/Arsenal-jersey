/** Response shapes of the store API (see the backend's OpenAPI docs at /api/docs). Money is in cents. */

import type { ProductBadge, ProductSpec, Size } from './index';

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ApiCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
}

export interface ApiSizeStock {
  size: Size;
  stockQuantity: number;
  inStock: boolean;
  /** Admin responses only. */
  isLowStock?: boolean;
}

export interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  description: string;
  category: { id: string; slug: string; name: string };
  priceCents: number;
  currency: string;
  sku: string;
  images: string[];
  features: string[];
  specs: ProductSpec[];
  tags: string[];
  badge: ProductBadge | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  isCustomizable: boolean;
  printPriceCents: number;
  printColor: string | null;
  colorName: string | null;
  colorHex: string | null;
  rating: number | null;
  reviewCount: number;
  sizes: ApiSizeStock[];
  totalStock: number;
  inStock: boolean;
  // Admin responses only:
  lowStockThreshold?: number;
  isActive?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiMe {
  id: string;
  email: string;
  name: string;
  role: 'CUSTOMER' | 'ADMIN';
  emailVerified: boolean;
}

export interface ApiInventoryRow {
  variantId: string;
  productId: string;
  name: string;
  sku: string;
  size: Size;
  categoryName: string;
  isActive: boolean;
  stockQuantity: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  totalSold: number;
}

export interface ApiInventory extends Paginated<ApiInventoryRow> {
  summary: {
    totalProducts: number;
    totalUnitsInStock: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalUnitsSold: number;
  };
}

export interface ApiUpload {
  url: string;
  key: string;
  contentType: string;
  size: number;
}
