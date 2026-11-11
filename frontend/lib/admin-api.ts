import type { ApiCategory, ApiInventory, ApiMe, ApiProduct, ApiUpload, Paginated } from '@/types/api';
import type { Size } from '@/types';
import { api } from './api';

/** Body for creating a product (mirrors the backend's createProductBody). */
export interface ProductInput {
  name: string;
  slug?: string;
  subtitle: string | null;
  description: string;
  categoryId: string;
  priceCents: number;
  sku: string;
  images: string[];
  features: string[];
  specs: { label: string; value: string }[];
  tags: string[];
  badge: 'NEW' | 'LIMITED' | null;
  isFeatured: boolean;
  isBestSeller: boolean;
  isCustomizable: boolean;
  printPriceCents: number;
  printColor: string | null;
  colorName: string | null;
  colorHex: string | null;
  lowStockThreshold: number;
  isActive: boolean;
}
export type CreateProductInput = ProductInput & { sizes: { size: Size; stockQuantity: number }[] };

export interface CategoryInput {
  name: string;
  slug?: string;
  description: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  return q.toString();
};

/** Typed wrappers for every admin endpoint. All of them need an ADMIN session cookie. */
export const adminApi = {
  me: () => api<{ data: ApiMe }>('/api/me'),
  signIn: (email: string, password: string) => api('/api/auth/sign-in/email', { method: 'POST', body: { email, password } }),
  signOut: () => api('/api/auth/sign-out', { method: 'POST', body: {} }),

  categories: () => api<{ data: ApiCategory[] }>('/api/admin/categories'),
  createCategory: (body: CategoryInput) => api<{ data: ApiCategory }>('/api/admin/categories', { method: 'POST', body }),
  updateCategory: (id: string, body: Partial<CategoryInput>) => api<{ data: ApiCategory }>(`/api/admin/categories/${id}`, { method: 'PATCH', body }),
  deleteCategory: (id: string) => api<{ data: { id: string } }>(`/api/admin/categories/${id}`, { method: 'DELETE' }),

  products: (params: { page?: number; pageSize?: number; search?: string; category?: string; status?: string }) =>
    api<Paginated<ApiProduct>>(`/api/admin/products?${qs(params)}`),
  product: (id: string) => api<{ data: ApiProduct }>(`/api/admin/products/${id}`),
  createProduct: (body: CreateProductInput) => api<{ data: ApiProduct }>('/api/admin/products', { method: 'POST', body }),
  updateProduct: (id: string, body: Partial<ProductInput>) => api<{ data: ApiProduct }>(`/api/admin/products/${id}`, { method: 'PATCH', body }),
  deleteProduct: (id: string) => api<{ data: { id: string; mode: 'hard' | 'soft' } }>(`/api/admin/products/${id}`, { method: 'DELETE' }),
  setStock: (id: string, body: { size: Size; set?: number; change?: number; note?: string }) =>
    api<{ data: ApiProduct }>(`/api/admin/products/${id}/stock`, { method: 'POST', body }),

  inventory: (params: { page?: number; pageSize?: number; lowStockOnly?: boolean }) => api<ApiInventory>(`/api/admin/inventory?${qs(params)}`),

  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<{ data: ApiUpload }>('/api/admin/uploads', { method: 'POST', form });
  },
};
