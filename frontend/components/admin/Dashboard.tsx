'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Alert, PageHeader, Panel, Spinner, inputClass } from '@/components/admin/ui';
import { Button } from '@/components/ui/Button';
import { adminApi } from '@/lib/admin-api';
import { cn } from '@/lib/utils';
import type { ApiInventory, ApiInventoryRow } from '@/types/api';

const LOW_STOCK_ROWS = 15;

const stat = (label: string, value: number, tone?: 'red') => ({ label, value, tone });

/** Stock overview, plus the sizes that need restocking with a one-step "add stock" box. */
export function Dashboard() {
  const [inventory, setInventory] = useState<ApiInventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInventory(await adminApi.inventory({ lowStockOnly: true, pageSize: LOW_STOCK_ROWS }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the stock overview.');
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const restock = async (row: ApiInventoryRow, amount: number) => {
    try {
      await adminApi.setStock(row.productId, { size: row.size, change: amount, note: 'Quick restock from the dashboard' });
      setNotice(`Added ${amount} to ${row.name} (${row.size === 'OS' ? 'one size' : row.size}).`);
      setError(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add stock.');
    }
  };

  const s = inventory?.summary;
  const stats = s
    ? [
        stat('Products', s.totalProducts),
        stat('Units in stock', s.totalUnitsInStock),
        stat('Sizes running low', s.lowStockCount, s.lowStockCount > 0 ? 'red' : undefined),
        stat('Sizes sold out', s.outOfStockCount, s.outOfStockCount > 0 ? 'red' : undefined),
        stat('Units sold', s.totalUnitsSold),
      ]
    : [];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A quick look at your stock."
        actions={
          <>
            <Button href="/admin/products/new">
              <Plus aria-hidden className="size-4" /> Add product
            </Button>
            <Button href="/admin/categories" variant="secondary">
              Categories
            </Button>
          </>
        }
      />

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {!inventory && !error && <Spinner label="Loading stock overview…" />}

      {inventory && (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {stats.map((item) => (
              <div key={item.label} className="border border-line bg-white p-4">
                <dt className="eyebrow text-ink/60">{item.label}</dt>
                <dd className={cn('headline mt-2 text-4xl tabular-nums', item.tone === 'red' && 'text-primary')}>{item.value}</dd>
              </div>
            ))}
          </dl>

          <Panel title="Needs restocking" description="Sizes at or below their low-stock level. Add stock right here." className="mt-6">
            {notice && <div className="mb-4"><Alert tone="success">{notice}</Alert></div>}
            {inventory.data.length === 0 ? (
              <p className="py-6 text-sm text-ink/60">Everything is comfortably stocked. 🎉</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="eyebrow py-2 pr-4">Product</th>
                      <th scope="col" className="eyebrow py-2 pr-4">Size</th>
                      <th scope="col" className="eyebrow py-2 pr-4">In stock</th>
                      <th scope="col" className="eyebrow py-2">Add stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.data.map((row) => (
                      <RestockRow key={row.variantId} row={row} onRestock={restock} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {inventory.pagination.total > inventory.data.length && (
              <p className="mt-3 text-micro text-muted">
                Showing {inventory.data.length} of {inventory.pagination.total}. <Link href="/admin/products" className="underline">See all products</Link>.
              </p>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function RestockRow({ row, onRestock }: { row: ApiInventoryRow; onRestock: (row: ApiInventoryRow, amount: number) => Promise<void> }) {
  const [amount, setAmount] = useState('10');
  const [busy, setBusy] = useState(false);
  const valid = /^[1-9]\d{0,5}$/.test(amount);
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-3 pr-4">
        <Link href={`/admin/products/${row.productId}`} className="font-semibold hover:text-primary">
          {row.name}
        </Link>
        <span className="block text-micro text-muted">{row.sku}</span>
      </td>
      <td className="py-3 pr-4 font-semibold">{row.size === 'OS' ? 'One size' : row.size}</td>
      <td className={cn('py-3 pr-4 font-semibold tabular-nums', row.stockQuantity === 0 && 'text-primary')}>{row.stockQuantity === 0 ? 'Sold out' : row.stockQuantity}</td>
      <td className="py-3">
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid) return;
            setBusy(true);
            await onRestock(row, Number(amount));
            setBusy(false);
          }}
        >
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" aria-label={`Units to add to ${row.name}, ${row.size}`} className={cn(inputClass, 'w-20')} />
          <Button type="submit" size="sm" variant="secondary" disabled={!valid || busy} className="h-10">
            {busy ? 'Adding…' : 'Add'}
          </Button>
        </form>
      </td>
    </tr>
  );
}
