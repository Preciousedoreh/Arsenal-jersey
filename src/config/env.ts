import { z } from 'zod';

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const origin = z.url().transform((u) => new URL(u).origin);

/** Express `trust proxy` accepts a boolean, hop count, or subnet list. */
const trustProxy = z
  .string()
  .default('false')
  .transform((v): boolean | number | string => {
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^\d+$/.test(v)) return Number(v);
    return v;
  });

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(0).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY: trustProxy,

    STORE_NAME: z.string().min(1).default('Jersey Store'),
    STORE_CURRENCY: z
      .string()
      .regex(/^[A-Z]{3}$/, 'Must be an ISO-4217 code, e.g. USD')
      .default('USD'),

    BETTER_AUTH_URL: z.url(),
    FRONTEND_URL: z.url(),
    CORS_ORIGINS: csv.pipe(z.array(origin)),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

    BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
    PASSWORD_BREACH_CHECK: bool.default(true),

    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().min(12).optional(),
    ADMIN_NAME: z.string().min(1).default('Store Admin'),

    RATE_LIMIT_STORE: z.enum(['memory', 'redis']).default('memory'),
    RATE_LIMIT_API_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(100),
    AUTH_RATE_LIMIT_ENABLED: bool.default(true),
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    LOGIN_WINDOW_SECONDS: z.coerce.number().int().positive().default(900),
    LOCKOUT_THRESHOLD: z.coerce.number().int().positive().default(10),
    LOCKOUT_DURATION_MINUTES: z.coerce.number().int().positive().default(30),

    EMAIL_TRANSPORT: z.enum(['smtp', 'memory']).default('smtp'),
    EMAIL_FROM: z.string().min(3),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: bool.default(false),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),

    QUEUE_DRIVER: z.enum(['bullmq', 'inline']).default('bullmq'),
    RUN_WORKERS_IN_PROCESS: bool.default(true),

    PAYMENT_PROVIDER: z.enum(['mock']).default('mock'),
    PAYMENT_WEBHOOK_SECRET: z.string().min(16),

    API_DOCS_ENABLED: bool.default(true),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.EMAIL_TRANSPORT === 'memory') {
        ctx.addIssue({
          code: 'custom',
          path: ['EMAIL_TRANSPORT'],
          message: 'memory transport is not allowed in production',
        });
      }
      if (env.QUEUE_DRIVER === 'inline') {
        ctx.addIssue({
          code: 'custom',
          path: ['QUEUE_DRIVER'],
          message: 'inline queue is not allowed in production',
        });
      }
      if (!env.BETTER_AUTH_URL.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['BETTER_AUTH_URL'],
          message: 'must use https in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Treat empty strings as "unset" so `.env` lines like `SMTP_USER=` fall back to defaults/optional.
  const raw = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ''));
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`,
    );
    // Fail fast: the process must not start with a broken configuration.
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Every origin allowed to make credentialed browser requests (CORS + CSRF origin check). */
export const allowedOrigins: ReadonlySet<string> = new Set([
  ...env.CORS_ORIGINS,
  new URL(env.FRONTEND_URL).origin,
  new URL(env.BETTER_AUTH_URL).origin,
]);
