import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware, isAPIError } from 'better-auth/api';
import { haveIBeenPwned } from 'better-auth/plugins';
import { allowedOrigins, env, isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';
import { notifications } from '../services/notifications.js';
import { loginGuard, normalizeEmail } from './loginGuard.js';
import { prisma } from './prisma.js';
import { rateLimitCounter } from './rateLimitCounter.js';

/** Header our Express layer sets from `req.ip` (overwriting any client value) for Better Auth to read. */
export const CLIENT_IP_HEADER = 'x-client-ip';

const RESET_TOKEN_TTL_SECONDS = 60 * 60;

const TOKEN_STRIPPED_PATHS = new Set([
  '/sign-in/email',
  '/sign-up/email',
  '/get-session',
  '/change-password', // returns a fresh session token when revokeOtherSessions is set
]);

function stripTokens(body: object): Record<string, unknown> {
  const { token: _token, ...rest } = body as Record<string, unknown>;
  const session = rest.session;
  if (session && typeof session === 'object') {
    const { token: _sessionToken, ...safeSession } = session as Record<string, unknown>;
    rest.session = safeSession;
  }
  return rest;
}

export const auth = betterAuth({
  appName: env.STORE_NAME,
  baseURL: env.BETTER_AUTH_URL,
  basePath: '/api/auth',
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [...allowedOrigins],
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  telemetry: { enabled: false },
  // Route Better Auth's internal logs through pino (one format, same redaction, respects LOG_LEVEL).
  logger: {
    log: (level, message, ...args) => logger[level]({ component: 'better-auth', args }, message),
  },

  user: {
    additionalFields: {
      // `input: false` → clients can never set their own role on sign-up or update.
      role: { type: 'string', required: false, defaultValue: 'CUSTOMER', input: false },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh expiry at most once a day
  },

  emailAndPassword: {
    enabled: true,
    // Unverified users may sign in (so they can resend verification) but cannot place orders.
    requireEmailVerification: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await notifications.passwordReset(user, url, RESET_TOKEN_TTL_SECONDS / 60);
    },
    onPasswordReset: async ({ user }) => {
      await notifications.passwordChanged(user);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await notifications.verifyEmail(user, url);
    },
  },

  rateLimit: {
    enabled: env.AUTH_RATE_LIMIT_ENABLED,
    window: 60,
    max: 100,
    customRules: {
      // Per-IP ceiling. The stricter per IP+email limit (5 / 15 min) is enforced in hooks below.
      '/sign-in/email': { window: 15 * 60, max: 20 },
      '/sign-up/email': { window: 60 * 60, max: 5 },
      '/request-password-reset': { window: 60 * 60, max: 5 },
      '/send-verification-email': { window: 60 * 60, max: 5 },
      '/reset-password': { window: 60 * 60, max: 10 },
      '/change-password': { window: 15 * 60, max: 10 },
    },
    // Same store as the rest of the app: in-memory for dev, Redis in production.
    customStorage: { consume: (key, rule) => rateLimitCounter.consume(key, rule) },
  },

  advanced: {
    ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    useSecureCookies: isProduction,
    defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: isProduction },
  },

  plugins: env.PASSWORD_BREACH_CHECK
    ? [
        haveIBeenPwned({
          customPasswordCompromisedMessage:
            'This password has appeared in a data breach. Please choose a different one.',
        }),
      ]
    : [],

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/sign-in/email') {
        const email = typeof ctx.body?.email === 'string' ? normalizeEmail(ctx.body.email) : '';
        if (email)
          await loginGuard.beforeAttempt(email, ctx.headers?.get(CLIENT_IP_HEADER) ?? 'unknown');
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      const returned = ctx.context.returned;

      if (ctx.path === '/sign-in/email') {
        const email = typeof ctx.body?.email === 'string' ? normalizeEmail(ctx.body.email) : '';
        if (!email) return;
        if (ctx.context.newSession) {
          await loginGuard.onSuccess(email, ctx.headers?.get(CLIENT_IP_HEADER) ?? 'unknown');
        } else if (isAPIError(returned) && returned.statusCode === 401) {
          await loginGuard.onFailure(email);
        }
        return;
      }

      if (ctx.path === '/change-password' && returned && !isAPIError(returned)) {
        const user =
          (returned as { user?: { email: string; name: string } }).user ??
          ctx.context.session?.user;
        if (user) await notifications.passwordChanged(user);
      }

      // The session lives in an httpOnly cookie; don't also hand the raw token to page JavaScript.
      if (
        TOKEN_STRIPPED_PATHS.has(ctx.path) &&
        returned &&
        typeof returned === 'object' &&
        !isAPIError(returned)
      ) {
        return ctx.json(stripTokens(returned));
      }
    }),
  },
});

export type AuthSession = typeof auth.$Infer.Session;
