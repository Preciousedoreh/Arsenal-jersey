import Link from 'next/link';
import { ProductCard } from '@/components/ui/ProductCard';
import { categoryHref } from '@/lib/site';
import { cn } from '@/lib/utils';
import type { Category, Product } from '@/types';

/** Category filter chips + a responsive grid of product cards. */
export function ProductGrid({ products, categories, activeSlug }: { products: Product[]; categories: Category[]; activeSlug?: string }) {
  const chips = [{ label: 'All', href: '/shop', active: !activeSlug }, ...categories.filter((c) => c.productCount > 0).map((c) => ({ label: c.name, href: categoryHref(c.slug), active: c.slug === activeSlug }))];

  return (
    <>
      <nav aria-label="Categories" className="mb-8">
        <ul className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.href}>
              <Link
                href={chip.href}
                aria-current={chip.active ? 'page' : undefined}
                className={cn(
                  'eyebrow inline-flex h-9 items-center rounded-btn border px-4 transition-colors',
                  chip.active ? 'border-primary bg-primary text-white' : 'border-line text-ink/70 hover:border-ink hover:text-ink',
                )}
              >
                {chip.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {products.length === 0 ? (
        <p className="border border-line bg-surface p-10 text-center text-sm text-ink/70">No kits here yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} variant="compact" />
          ))}
        </div>
      )}
    </>
  );
}
