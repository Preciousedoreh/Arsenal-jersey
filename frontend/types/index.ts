/**
 * Shared domain types for the storefront. Prices here are in dollars (the API sends cents; see
 * lib/catalog.ts for the conversion).
 */

/** "OS" = one size, for non-apparel items. */
export type Size = 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'OS';

export type ProductBadge = 'NEW' | 'LIMITED';

export interface ProductColor {
  name: string;
  /** Swatch colour (CSS colour value). */
  hex: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface SizeStock {
  size: Size;
  /** Units available in this size. 0 = sold out. */
  stock: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  /** Short line shown under the name in detail views. */
  subtitle?: string;
  price: number;
  /** Gallery: [front, back, detail, …]. The first image is the primary product shot. */
  images: readonly string[];
  /** Paragraph shown on the product page. */
  description: string;
  /** Short selling points (bullets). */
  features: string[];
  /** Fabric, fit, care… shown as a table under "Details & care". */
  specs: ProductSpec[];
  sku: string;
  tags: string[];
  /** Sizes on sale, in S → XXL order, each with its own stock. */
  sizes: SizeStock[];
  /** Units in stock across all sizes. */
  stock: number;
  /** Name & number printing offered? */
  customizable: boolean;
  /** Extra price (dollars) when personalised. */
  printPrice: number;
  /** Colour of the printed lettering on this shirt (CSS colour), for the live preview. */
  printColor?: string;
  colors: ProductColor[];
  /** 0 when there are no ratings. */
  rating: number;
  reviewCount: number;
  badge?: ProductBadge;
  isFeatured: boolean;
  isBestSeller: boolean;
  category: string;
  categoryName: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Tile photo; falls back to a bundled placeholder for the starter categories. */
  image?: string;
  /** Active, purchasable products in this category. */
  productCount: number;
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  avatar: string;
  rating: number;
}

export interface NavLink {
  label: string;
  href: string;
  children?: NavLink[];
}

export interface CartItem {
  /** Unique per product + options, so the same shirt in two sizes is two lines. */
  key: string;
  productId: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size?: Size;
  color?: string;
  /** Printed name & number for customised shirts. */
  customization?: { name: string; number: string };
}
