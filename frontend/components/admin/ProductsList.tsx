'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Alert, ConfirmDialog, PageHeader, Pill, Spinner, inputClass } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import { adminApi } from '@/lib/admin-api';
import { cn, formatPriceExact } from '@/lib/utils';
import type { ApiCategory, ApiProduct, Paginated } from '@/types/api';

const PAGE_SIZE = 15;
const SEARCH_DEBOUNCE_MS = 300;

/** Searchable, filterable product table with show/hide and delete. */
export function ProductsList() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('active-and-hidden');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Paginated<ApiProduct> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ApiProduct | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminApi.categories().then(({ data }) => setCategories(data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setError(null);
      // "all" includes soft-deleted products; the default view hides those.
      const res = await adminApi.products({ page, pageSize: PAGE_SIZE, search: query || undefined, category: category || undefined, status: status === 'active-and-hidden' ? undefined : status });
      setResult(status === 'active-and-hidden' ? { ...res, data: res.data.filter((p) => !p.deletedAt) } : res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load products.');
    }
  }, [page, query, category, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleVisible = async (p: ApiProduct) => {
    try {
      await adminApi.updateProduct(p.id, { isActive: !p.isActive });
      setNotice(`${p.name} is now ${p.isActive ? 'hidden from' : 'visible in'} the shop.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update.');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      const { data } = await adminApi.deleteProduct(toDelete.id);
      setNotice(data.mode === 'hard' ? `${toDelete.name} was deleted.` : `${toDelete.name} has orders, so it was hidden and archived instead of deleted.`);
      setToDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete.');
      setToDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const totalPages = result?.pagination.totalPages ?? 1;

  return (
    <>
      <PageHeader
        title="Products"
        description="Every kit in the shop. Add new jerseys, edit details and photos, and manage stock by size."
        actions={
          <Button href="/admin/products/new">
            <Plus aria-hidden className="size-4" /> Add product
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink/40" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" aria-label="Search products" className={cn(inputClass, 'pl-9')} />
        </div>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label="Filter by category" className={cn(inputClass, 'w-auto min-w-44')}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status" className={cn(inputClass, 'w-auto min-w-40')}>
          <option value="active-and-hidden">Live &amp; hidden</option>
          <option value="active">Live only</option>
          <option value="inactive">Hidden only</option>
          <option value="deleted">Archived</option>
        </select>
      </div>

      <div className="space-y-3">
        {notice && <Alert tone="success">{notice}</Alert>}
        {error && <Alert>{error}</Alert>}
      </div>

      {!result && !error ? (
        <Spinner label="Loading products…" />
      ) : result && (
        <div className="mt-3 overflow-x-auto border border-line bg-white">
          <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface">
                <th scope="col" className="eyebrow px-4 py-3">Product</th>
                <th scope="col" className="eyebrow px-4 py-3">Category</th>
                <th scope="col" className="eyebrow px-4 py-3">Price</th>
                <th scope="col" className="eyebrow px-4 py-3">Stock by size</th>
                <th scope="col" className="eyebrow px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {result.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-ink/60">
                    No products found. <Link href="/admin/products/new" className="font-semibold underline">Add the first one</Link>.
                  </td>
                </tr>
              )}
              {result.data.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center overflow-hidden bg-surface">
                        {p.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt="" className="size-full object-contain p-1" />
                        ) : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold hover:text-primary">{p.name}</span>
                        <span className="block truncate text-micro text-muted">{p.sku}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink/70">{p.category.name}</td>
                  <td className="px-4 py-3 tabular-nums">{formatPriceExact(p.priceCents / 100)}</td>
                  <td className="px-4 py-3">
                    <ul className="flex flex-wrap gap-1.5" aria-label={`Stock for ${p.name}`}>
                      {p.sizes.map((s) => (
                        <li key={s.size} className={cn('rounded-[3px] border px-1.5 py-0.5 text-tiny font-semibold tabular-nums', s.stockQuantity === 0 ? 'border-ink/20 text-ink/40 line-through' : s.isLowStock ? 'border-primary/40 bg-primary/5 text-primary' : 'border-line text-ink/70')}>
                          {s.size === 'OS' ? 'One size' : s.size} {s.stockQuantity}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-micro text-muted">{p.totalStock} total</p>
                  </td>
                  <td className="px-4 py-3">
                    {p.deletedAt ? <Pill>Archived</Pill> : p.isActive ? <Pill tone="green">Live</Pill> : <Pill tone="gold">Hidden</Pill>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/products/${p.id}`} aria-label={`Edit ${p.name}`} className="grid size-9 place-items-center text-ink/60 hover:text-ink">
                        <Pencil aria-hidden className="size-4" />
                      </Link>
                      {!p.deletedAt && (
                        <button type="button" onClick={() => toggleVisible(p)} className="eyebrow px-2 py-2 text-ink/60 hover:text-ink">
                          {p.isActive ? 'Hide' : 'Show'}
                        </button>
                      )}
                      <button type="button" onClick={() => setToDelete(p)} aria-label={`Delete ${p.name}`} className="grid size-9 place-items-center text-ink/60 hover:text-primary">
                        <Trash2 aria-hidden className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-4 flex items-center justify-between text-sm">
          <p className="text-ink/60">
            Page {page} of {totalPages} · {result.pagination.total} products
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage((n) => n - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setPage((n) => n + 1)} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </nav>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete this product?"
        message={
          <>
            <strong>{toDelete?.name}</strong> will be removed from the shop. If customers have already ordered it, it is archived instead so order history stays intact.
          </>
        }
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
