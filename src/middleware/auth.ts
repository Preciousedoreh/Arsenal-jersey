import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../lib/auth.js';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.js';

export type Role = 'CUSTOMER' | 'ADMIN';

export interface AuthContext {
  user: { id: string; email: string; name: string; role: Role; emailVerified: boolean };
  sessionId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Resolves the session cookie via Better Auth. Role is read fresh from the DB on every request.
 * When Better Auth slides the session expiry (once per `updateAge`) it issues a refreshed cookie;
 * we forward that Set-Cookie, otherwise the browser would drop the cookie at its original expiry
 * even though the session is still valid server-side.
 */
export const requireAuth: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const { headers, response: session } = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
    returnHeaders: true,
  });
  const cookies = headers.getSetCookie();
  if (cookies.length > 0) res.append('Set-Cookie', cookies);
  if (!session) throw new UnauthorizedError();
  const { user } = session;
  req.auth = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
      emailVerified: user.emailVerified,
    },
    sessionId: session.session.id,
  };
  next();
};

export const requireVerified: RequestHandler = (req, _res, next) => {
  if (!getAuth(req).user.emailVerified) {
    throw new ForbiddenError('Please verify your email address first', 'EMAIL_NOT_VERIFIED');
  }
  next();
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!roles.includes(getAuth(req).user.role)) throw new ForbiddenError();
    next();
  };

/** Use inside handlers mounted behind `requireAuth`. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw new UnauthorizedError();
  return req.auth;
}
