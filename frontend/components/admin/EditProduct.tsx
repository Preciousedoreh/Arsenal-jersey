'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Alert, PageHeader, Pill, Spinner } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/ProductForm';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import type { ApiProduct } from '@/types/api';

/** Loads one product for editing. */
export function EditProduct({ id }: { id: string }) {
  const justCreated = useSearchParams().get('created') === '1';
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    adminApi
      .product(id)
      .then(({ data }) => setProduct(data))
      .catch((e: unknown) => setError({ status: e instanceof ApiError ? e.status : 0, message: e instanceof Error ? e.message : 'Could not load the product.' }));
  }, [id]);

  if (error) {
    return (
      <>
        <PageHeader title={error.status === 404 ? 'Product not found' : 'Could not load product'} />
        <Alert>{error.message}</Alert>
        <Link href="/admin/products" className="eyebrow mt-4 inline-block underline underline-offset-4">
          Back to products
        </Link>
      </>
    );
  }
  if (!product) return <Spinner label="Loading product…" />;

  return (
    <>
      <PageHeader
        title={product.name}
        description={`SKU ${product.sku}`}
        actions={
          <>
            {product.deletedAt ? <Pill>Archived</Pill> : product.isActive ? <Pill tone="green">Live</Pill> : <Pill tone="gold">Hidden</Pill>}
            {product.isActive && !product.deletedAt && (
              <Link href={`/products/${product.slug}`} target="_blank" className="eyebrow inline-flex items-center gap-1.5 text-ink/70 hover:text-primary">
                <ExternalLink aria-hidden className="size-3.5" /> View in shop
              </Link>
            )}
          </>
        }
      />
      {justCreated && (
        <div className="mb-5">
          <Alert tone="success">Product created. You can keep editing it here.</Alert>
        </div>
      )}
      <ProductForm product={product} onSaved={setProduct} />
    </>
  );
}
