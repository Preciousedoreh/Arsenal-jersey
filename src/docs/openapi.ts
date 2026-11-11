import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  type RouteConfig,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { env } from '../config/env.js';
import {
  inventoryQuery,
  inventoryReasonSchema,
  movementsQuery,
} from '../modules/inventory/inventory.schemas.js';
import {
  adminListOrdersQuery,
  cancelOrderBody,
  createOrderBody,
  listOrdersQuery,
  orderIdParams,
  orderStatusSchema,
  shippingAddressSchema,
  updateOrderStatusBody,
} from '../modules/orders/orders.schemas.js';
import {
  adminListProductsQuery,
  createProductBody,
  listProductsQuery,
  productCategorySchema,
  productIdParams,
  productSlugParams,
  stockAdjustmentBody,
  updateProductBody,
} from '../modules/products/products.schemas.js';
import {
  listUsersQuery,
  roleSchema,
  updateMeBody,
  updateRoleBody,
  userIdParams,
} from '../modules/users/users.schemas.js';

/**
 * OpenAPI 3.1 document generated from the same zod schemas used for request validation,
 * so the docs can't drift from what the API actually accepts.
 */
const registry = new OpenAPIRegistry();

const cookieAuth = registry.registerComponent('securitySchemes', 'cookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'better-auth.session_token',
  description:
    'Session cookie set by POST /api/auth/sign-in/email. In production the cookie is prefixed with __Secure-.',
});
const secured = [{ [cookieAuth.name]: [] }];

// ── Response schemas ──
const ErrorResponse = z
  .object({
    error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
  })
  .meta({ id: 'ErrorResponse' });

const Pagination = z
  .object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  })
  .meta({ id: 'Pagination' });

const PublicProduct = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    category: productCategorySchema,
    priceCents: z.number().int(),
    currency: z.string(),
    sku: z.string(),
    images: z.array(z.string()),
    stockQuantity: z.number().int(),
    inStock: z.boolean(),
  })
  .meta({ id: 'PublicProduct' });

const AdminProduct = PublicProduct.extend({
  lowStockThreshold: z.number().int(),
  isLowStock: z.boolean(),
  isActive: z.boolean(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).meta({ id: 'AdminProduct' });

const OrderItem = z
  .object({
    id: z.string(),
    productId: z.string(),
    productName: z.string(),
    productSku: z.string(),
    unitPriceCents: z.number().int(),
    quantity: z.number().int(),
    lineTotalCents: z.number().int(),
  })
  .meta({ id: 'OrderItem' });

const Order = z
  .object({
    id: z.string(),
    status: orderStatusSchema,
    currency: z.string(),
    subtotalCents: z.number().int(),
    totalCents: z.number().int(),
    shippingAddress: shippingAddressSchema.nullable(),
    paymentProvider: z.string().nullable(),
    paidAt: z.string().nullable(),
    shippedAt: z.string().nullable(),
    deliveredAt: z.string().nullable(),
    cancelledAt: z.string().nullable(),
    cancelReason: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    items: z.array(OrderItem),
  })
  .meta({ id: 'Order' });

const AdminOrder = Order.extend({
  paymentReference: z.string().nullable(),
  customer: z.object({ id: z.string(), email: z.string(), name: z.string() }),
}).meta({ id: 'AdminOrder' });

const User = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    image: z.string().nullable(),
    role: roleSchema,
    emailVerified: z.boolean(),
    createdAt: z.string(),
  })
  .meta({ id: 'User' });

const InventoryRow = z
  .object({
    productId: z.string(),
    name: z.string(),
    sku: z.string(),
    category: productCategorySchema,
    isActive: z.boolean(),
    stockQuantity: z.number().int(),
    lowStockThreshold: z.number().int(),
    isLowStock: z.boolean(),
    totalSold: z.number().int(),
  })
  .meta({ id: 'InventoryRow' });

const Movement = z
  .object({
    id: z.string(),
    productId: z.string(),
    productName: z.string(),
    change: z.number().int(),
    stockAfter: z.number().int(),
    reason: inventoryReasonSchema,
    note: z.string().nullable(),
    orderId: z.string().nullable(),
    admin: z.object({ id: z.string(), email: z.string() }).nullable(),
    createdAt: z.string(),
  })
  .meta({ id: 'InventoryMovement' });

const json = (schema: z.ZodType, description = 'OK') => ({
  description,
  content: { 'application/json': { schema } },
});
const data = (schema: z.ZodType) => z.object({ data: schema });
const page = (schema: z.ZodType) => z.object({ data: z.array(schema), pagination: Pagination });
const err = (description: string) => json(ErrorResponse, description);
const body = (schema: z.ZodType) => ({ body: { content: { 'application/json': { schema } } } });

const commonErrors = {
  400: err('Validation error'),
  429: err('Rate limited (see Retry-After header)'),
};
const authErrors = { 401: err('Not signed in') };
const adminErrors = { ...authErrors, 403: err('Not an admin') };

function route(config: Omit<RouteConfig, 'responses'> & { responses: RouteConfig['responses'] }) {
  registry.registerPath({ ...config, responses: { ...commonErrors, ...config.responses } });
}

// ── Auth (Better Auth) — the main endpoints the frontend needs ──
const authPost = (path: string, summary: string, schema: z.ZodType, description?: string) =>
  route({
    method: 'post',
    path: `/api/auth${path}`,
    tags: ['Auth'],
    summary,
    ...(description ? { description } : {}),
    request: body(schema),
    responses: { 200: { description: 'OK' } },
  });

authPost(
  '/sign-up/email',
  'Register with email + password',
  z.object({
    name: z.string(),
    email: z.email(),
    password: z.string().min(8),
    callbackURL: z.string().optional(),
  }),
  'Creates a CUSTOMER account, signs in, and emails a verification link. `callbackURL` is where the link redirects after verifying.',
);
authPost(
  '/sign-in/email',
  'Sign in (sets session cookie)',
  z.object({ email: z.email(), password: z.string(), rememberMe: z.boolean().optional() }),
  `Rate limited to ${env.LOGIN_MAX_ATTEMPTS} attempts per ${env.LOGIN_WINDOW_SECONDS / 60} min per IP+email. ${env.LOCKOUT_THRESHOLD} consecutive failures lock the account for ${env.LOCKOUT_DURATION_MINUTES} min.`,
);
authPost('/sign-out', 'Sign out current session', z.object({}));
authPost(
  '/request-password-reset',
  'Forgot password — email a reset link',
  z.object({ email: z.email(), redirectTo: z.string().optional() }),
  'Always returns the same response whether or not the email exists.',
);
authPost(
  '/reset-password',
  'Reset password with token',
  z.object({ newPassword: z.string().min(8), token: z.string() }),
  'Single-use, 1-hour token. Revokes all sessions.',
);
authPost(
  '/change-password',
  'Change password (signed in)',
  z.object({
    currentPassword: z.string(),
    newPassword: z.string().min(8),
    revokeOtherSessions: z.boolean().optional(),
  }),
);
authPost(
  '/send-verification-email',
  'Resend verification email',
  z.object({ email: z.email(), callbackURL: z.string().optional() }),
);
authPost('/revoke-sessions', 'Sign out of all devices', z.object({}));
route({
  method: 'get',
  path: '/api/auth/verify-email',
  tags: ['Auth'],
  summary: 'Verify email (link target)',
  request: { query: z.object({ token: z.string(), callbackURL: z.string().optional() }) },
  responses: { 200: { description: 'Verified (or redirect to callbackURL)' } },
});
route({
  method: 'get',
  path: '/api/auth/get-session',
  tags: ['Auth'],
  summary: 'Current session',
  responses: { 200: { description: 'Session or null' } },
});
route({
  method: 'get',
  path: '/api/auth/list-sessions',
  tags: ['Auth'],
  summary: 'List active sessions',
  security: secured,
  responses: { 200: { description: 'Sessions' } },
});

// ── Me ──
route({
  method: 'get',
  path: '/api/me',
  tags: ['Me'],
  summary: 'Current user + role',
  security: secured,
  responses: { 200: json(data(User)), ...authErrors },
});
route({
  method: 'patch',
  path: '/api/me',
  tags: ['Me'],
  summary: 'Update profile',
  security: secured,
  request: body(updateMeBody),
  responses: { 200: json(data(User)), ...authErrors },
});

// ── Products ──
route({
  method: 'get',
  path: '/api/products',
  tags: ['Products'],
  summary: 'List active products',
  request: { query: listProductsQuery },
  responses: { 200: json(page(PublicProduct)) },
});
route({
  method: 'get',
  path: '/api/products/{slug}',
  tags: ['Products'],
  summary: 'Product by slug',
  request: { params: productSlugParams },
  responses: { 200: json(data(PublicProduct)), 404: err('Not found') },
});

// ── Orders ──
route({
  method: 'post',
  path: '/api/orders',
  tags: ['Orders'],
  summary: 'Place an order (verified customers)',
  description:
    'Deducts stock atomically in one transaction. 409 INSUFFICIENT_STOCK rolls everything back.',
  security: secured,
  request: body(createOrderBody),
  responses: {
    201: json(data(Order), 'Created'),
    ...authErrors,
    403: err('Email not verified'),
    409: err('Insufficient stock / product unavailable'),
  },
});
route({
  method: 'get',
  path: '/api/orders',
  tags: ['Orders'],
  summary: 'My orders',
  security: secured,
  request: { query: listOrdersQuery },
  responses: { 200: json(page(Order)), ...authErrors },
});
route({
  method: 'get',
  path: '/api/orders/{id}',
  tags: ['Orders'],
  summary: 'My order',
  security: secured,
  request: { params: orderIdParams },
  responses: { 200: json(data(Order)), ...authErrors, 404: err('Not found') },
});
route({
  method: 'post',
  path: '/api/orders/{id}/cancel',
  tags: ['Orders'],
  summary: 'Cancel my PENDING order (restores stock)',
  security: secured,
  request: { params: orderIdParams, ...body(cancelOrderBody) },
  responses: { 200: json(data(Order)), ...authErrors, 409: err('Not cancellable') },
});
route({
  method: 'post',
  path: '/api/orders/{id}/pay',
  tags: ['Orders'],
  summary: 'Start payment for a PENDING order',
  security: secured,
  request: { params: orderIdParams },
  responses: {
    200: json(
      data(
        z.object({
          provider: z.string(),
          reference: z.string(),
          checkoutUrl: z.string().nullable(),
        }),
      ),
    ),
    ...authErrors,
  },
});
route({
  method: 'post',
  path: '/api/payments/webhook/{provider}',
  tags: ['Payments'],
  summary: 'Payment provider webhook',
  description:
    'Mock provider: JSON `{type, reference, amountCents, currency}` signed with HMAC-SHA256 (hex) of the raw body in `x-mock-signature`.',
  request: { params: z.object({ provider: z.string() }) },
  responses: { 200: { description: 'Handled' }, 404: err('Unknown reference/provider') },
});

// ── Admin ──
route({
  method: 'get',
  path: '/api/admin/products',
  tags: ['Admin · Products'],
  summary: 'All products incl. inactive/deleted',
  security: secured,
  request: { query: adminListProductsQuery },
  responses: { 200: json(page(AdminProduct)), ...adminErrors },
});
route({
  method: 'get',
  path: '/api/admin/products/{id}',
  tags: ['Admin · Products'],
  summary: 'Product by id',
  security: secured,
  request: { params: productIdParams },
  responses: { 200: json(data(AdminProduct)), ...adminErrors },
});
route({
  method: 'post',
  path: '/api/admin/products',
  tags: ['Admin · Products'],
  summary: 'Create product',
  security: secured,
  request: body(createProductBody),
  responses: {
    201: json(data(AdminProduct), 'Created'),
    ...adminErrors,
    409: err('Duplicate SKU/slug'),
  },
});
route({
  method: 'patch',
  path: '/api/admin/products/{id}',
  tags: ['Admin · Products'],
  summary: 'Update product (not stock)',
  security: secured,
  request: { params: productIdParams, ...body(updateProductBody) },
  responses: { 200: json(data(AdminProduct)), ...adminErrors },
});
route({
  method: 'delete',
  path: '/api/admin/products/{id}',
  tags: ['Admin · Products'],
  summary: 'Delete product (soft if it has orders)',
  security: secured,
  request: { params: productIdParams },
  responses: {
    200: json(data(z.object({ id: z.string(), mode: z.enum(['hard', 'soft']) }))),
    ...adminErrors,
  },
});
route({
  method: 'post',
  path: '/api/admin/products/{id}/stock',
  tags: ['Admin · Inventory'],
  summary: 'Adjust stock ({ change } or { set })',
  security: secured,
  request: { params: productIdParams, ...body(stockAdjustmentBody) },
  responses: { 200: json(data(AdminProduct)), ...adminErrors, 409: err('Would go negative') },
});
route({
  method: 'get',
  path: '/api/admin/inventory',
  tags: ['Admin · Inventory'],
  summary: 'Inventory dashboard',
  security: secured,
  request: { query: inventoryQuery },
  responses: {
    200: json(
      page(InventoryRow).extend({
        summary: z.object({
          totalProducts: z.number(),
          totalUnitsInStock: z.number(),
          lowStockCount: z.number(),
          outOfStockCount: z.number(),
          totalUnitsSold: z.number(),
        }),
      }),
    ),
    ...adminErrors,
  },
});
route({
  method: 'get',
  path: '/api/admin/inventory/movements',
  tags: ['Admin · Inventory'],
  summary: 'Inventory audit log',
  security: secured,
  request: { query: movementsQuery },
  responses: { 200: json(page(Movement)), ...adminErrors },
});
route({
  method: 'get',
  path: '/api/admin/orders',
  tags: ['Admin · Orders'],
  summary: 'All orders',
  security: secured,
  request: { query: adminListOrdersQuery },
  responses: { 200: json(page(AdminOrder)), ...adminErrors },
});
route({
  method: 'get',
  path: '/api/admin/orders/{id}',
  tags: ['Admin · Orders'],
  summary: 'Order by id',
  security: secured,
  request: { params: orderIdParams },
  responses: { 200: json(data(AdminOrder)), ...adminErrors },
});
route({
  method: 'patch',
  path: '/api/admin/orders/{id}/status',
  tags: ['Admin · Orders'],
  summary: 'Change order status',
  description:
    'PENDING→PAID→PROCESSING→SHIPPED→DELIVERED; CANCELLED from any state before SHIPPED (restores stock).',
  security: secured,
  request: { params: orderIdParams, ...body(updateOrderStatusBody) },
  responses: { 200: json(data(AdminOrder)), ...adminErrors, 409: err('Invalid transition') },
});
route({
  method: 'get',
  path: '/api/admin/users',
  tags: ['Admin · Users'],
  summary: 'List users',
  security: secured,
  request: { query: listUsersQuery },
  responses: { 200: json(page(User)), ...adminErrors },
});
route({
  method: 'patch',
  path: '/api/admin/users/{id}/role',
  tags: ['Admin · Users'],
  summary: 'Change a user role',
  security: secured,
  request: { params: userIdParams, ...body(updateRoleBody) },
  responses: { 200: json(data(User)), ...adminErrors },
});

route({
  method: 'get',
  path: '/api/health',
  tags: ['Health'],
  summary: 'Liveness + dependency checks',
  responses: { 200: { description: 'Healthy' }, 503: { description: 'Degraded' } },
});

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: `${env.STORE_NAME} API`,
      version: '0.1.0',
      description:
        'Jersey & merchandise store backend. Money is integer minor units (cents). Errors: `{ error: { code, message, details? } }` ' +
        '(Better Auth routes under /api/auth use their own `{ code, message }` format). State-changing requests with cookies must send an allow-listed `Origin`.',
    },
    servers: [{ url: env.BETTER_AUTH_URL }],
  });
}
