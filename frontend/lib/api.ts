/**
 * Thin fetch wrapper for the store API. Works on the server (storefront pages, cached briefly) and
 * in the browser (admin screens, with the session cookie). Errors become `ApiError`.
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** JSON body. */
  body?: unknown;
  /** multipart body (file uploads). */
  form?: FormData;
  /** Server-side cache lifetime in seconds. Omit for "always fresh" (admin screens). */
  revalidate?: number;
  signal?: AbortSignal;
}

export async function api<T>(path: string, { method = 'GET', body, form, revalidate, signal }: ApiOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: 'include', // send the session cookie (admin screens)
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
      ...(revalidate !== undefined ? { next: { revalidate } } : { cache: 'no-store' as const }),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check that the API is running.');
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Our API: { error: { code, message, details } }. Better Auth: { code, message }.
    const e = (payload as { error?: { code?: string; message?: string; details?: unknown }; code?: string; message?: string } | null) ?? {};
    throw new ApiError(
      response.status,
      e.error?.code ?? e.code ?? 'ERROR',
      e.error?.message ?? e.message ?? `Request failed (${response.status})`,
      e.error?.details,
    );
  }
  return payload as T;
}
