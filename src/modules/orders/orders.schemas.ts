import { z } from 'zod';
import { paginationQuery } from '../../utils/pagination.js';
import { sizeSchema, type Size } from '../products/products.schemas.js';

export const orderStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const shippingAddressSchema = z.strictObject({
  fullName: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(2).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'ISO-3166 alpha-2 country code'),
  phone: z.string().trim().max(30).optional(),
});
export type ShippingAddress = z.infer<typeof shippingAddressSchema>;

/** Name & number printed on a shirt (only for products that offer personalisation). */
export const customizationSchema = z
  .strictObject({
    name: z
      .string()
      .trim()
      .max(12)
      .regex(/^[\p{L} .'-]*$/u, 'Letters, spaces, apostrophes, dots and hyphens only')
      .transform((v) => v.toUpperCase())
      .default(''),
    number: z.string().regex(/^\d{0,2}$/, 'Up to two digits').default(''),
  })
  .refine((c) => c.name !== '' || c.number !== '', 'Provide a name, a number, or both');

export const orderItemInput = z.strictObject({
  productId: z.string().min(1).max(64),
  size: sizeSchema,
  quantity: z.number().int().min(1).max(100),
  customization: customizationSchema.optional(),
});

export const createOrderBody = z.strictObject({
  items: z.array(orderItemInput).min(1).max(50),
  shippingAddress: shippingAddressSchema.optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderBody>;

export const orderIdParams = z.object({ id: z.string().min(1).max(64) });

export const listOrdersQuery = paginationQuery.extend({
  status: orderStatusSchema.optional(),
});
export type ListOrdersQuery = z.infer<typeof listOrdersQuery>;

export const adminListOrdersQuery = listOrdersQuery.extend({
  from: z.coerce.date().optional(),
  /** A date-only value (2026-11-11) includes that whole day (UTC). */
  to: z
    .preprocess(
      (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:59.999Z` : v),
      z.coerce.date(),
    )
    .optional(),
  userId: z.string().min(1).max(64).optional(),
});
export type AdminListOrdersQuery = z.infer<typeof adminListOrdersQuery>;

export const cancelOrderBody = z.strictObject({
  reason: z.string().trim().max(500).optional(),
});

export const updateOrderStatusBody = z.strictObject({
  status: orderStatusSchema.exclude(['PENDING']),
  note: z.string().trim().max(500).optional(),
});
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusBody>;

/** Allowed admin status transitions. CANCELLED restores stock. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

// ── Response shapes ──

export interface OrderItemDto {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  size: Size;
  customization: { name: string; number: string } | null;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface OrderDto {
  id: string;
  status: OrderStatus;
  currency: string;
  subtotalCents: number;
  totalCents: number;
  shippingAddress: ShippingAddress | null;
  paymentProvider: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDto[];
}

export interface AdminOrderDto extends OrderDto {
  paymentReference: string | null;
  customer: { id: string; email: string; name: string };
}
