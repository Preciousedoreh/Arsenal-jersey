import type { Metadata } from 'next';
import { ProductGrid } from '@/components/product/ProductGrid';
import { Breadcrumbs } from '@/components/product/Breadcrumbs';
import { Container } from '@/components/ui/Container';
import { getCategories, getProducts } from '@/lib/catalog';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = { title: `All kits — ${siteConfig.name}`, description: siteConfig.description };

/** Every kit in the shop, with category filters. */
export default async function ShopPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return (
    <section aria-labelledby="shop-title" className="pb-section pt-6 md:pt-8">
      <Container>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Shop' }]} />
        <h1 id="shop-title" className="headline mt-6 text-[clamp(2.75rem,6vw,4.5rem)]">
          All kits
        </h1>
        <p className="mt-2 mb-8 text-sm text-ink/60">{products.length} {products.length === 1 ? 'kit' : 'kits'}</p>
        <ProductGrid products={products} categories={categories} />
      </Container>
    </section>
  );
}
