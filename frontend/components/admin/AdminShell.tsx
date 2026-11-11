'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { ExternalLink, LayoutDashboard, LogOut, Package, Tags } from 'lucide-react';
import { Logo } from '@/components/ui/Brand';
import { Spinner } from '@/components/admin/ui';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ApiMe } from '@/types/api';

const AdminContext = createContext<ApiMe | null>(null);
export const useAdminUser = () => useContext(AdminContext);

type State = { status: 'loading' } | { status: 'ok'; user: ApiMe } | { status: 'forbidden'; user: ApiMe } | { status: 'error'; message: string };

const nav = [
  { href: '/admin', label: 'Dashboard', Icon: LayoutDashboard, exact: true },
  { href: '/admin/products', label: 'Products', Icon: Package },
  { href: '/admin/categories', label: 'Categories', Icon: Tags },
] as const;

/**
 * Wraps every admin page: checks the session with the API (the API is what actually enforces the
 * admin role on every request; this just decides what to show), and provides the sidebar.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    adminApi
      .me()
      .then(({ data }) => !cancelled && setState(data.role === 'ADMIN' ? { status: 'ok', user: data } : { status: 'forbidden', user: data }))
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
        else setState({ status: 'error', message: error instanceof Error ? error.message : 'Something went wrong.' });
      });
    return () => {
      cancelled = true;
    };
    // Re-checking on every navigation isn't needed; the API re-checks on every call anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signOut = async () => {
    await adminApi.signOut().catch(() => undefined);
    router.replace('/admin/login');
  };

  if (state.status === 'loading') return <div className="mx-auto max-w-md px-4 pt-24"><Spinner label="Checking your session…" /></div>;
  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="headline text-3xl">Can’t reach the server</h1>
        <p className="mt-3 text-sm text-ink/70">{state.message}</p>
      </div>
    );
  }
  if (state.status === 'forbidden') {
    return (
      <div className="mx-auto max-w-md px-4 pt-24 text-center">
        <h1 className="headline text-3xl">No admin access</h1>
        <p className="mt-3 text-sm text-ink/70">{state.user.email} is signed in, but this account is not an administrator.</p>
        <button type="button" onClick={signOut} className="eyebrow mt-6 underline underline-offset-4 hover:text-primary">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={state.user}>
      <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="bg-ink text-white lg:sticky lg:top-0 lg:h-screen">
          <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:py-6">
            <Link href="/admin" aria-label="Admin home">
              <Logo tone="light" />
            </Link>
            <p className="eyebrow hidden text-gold-light lg:mt-1 lg:block">Admin</p>
          </div>
          <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
            {nav.map(({ href, label, Icon, ...rest }) => {
              const active = 'exact' in rest ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'eyebrow flex shrink-0 items-center gap-2.5 rounded-btn px-3 py-2.5 transition-colors',
                    active ? 'bg-primary text-white' : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon aria-hidden className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="hidden border-t border-white/10 p-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
            <p className="truncate text-micro text-white/60">{state.user.email}</p>
            <div className="mt-3 flex items-center gap-4">
              <Link href="/" target="_blank" className="eyebrow flex items-center gap-1.5 text-white/70 hover:text-white">
                <ExternalLink aria-hidden className="size-3.5" /> View store
              </Link>
              <button type="button" onClick={signOut} className="eyebrow flex items-center gap-1.5 text-white/70 hover:text-white">
                <LogOut aria-hidden className="size-3.5" /> Sign out
              </button>
            </div>
          </div>
        </aside>

        <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
          <div className="mt-10 flex gap-4 border-t border-line pt-4 lg:hidden">
            <Link href="/" target="_blank" className="eyebrow text-ink/60 hover:text-primary">
              View store
            </Link>
            <button type="button" onClick={signOut} className="eyebrow text-ink/60 hover:text-primary">
              Sign out
            </button>
          </div>
        </main>
      </div>
    </AdminContext.Provider>
  );
}
