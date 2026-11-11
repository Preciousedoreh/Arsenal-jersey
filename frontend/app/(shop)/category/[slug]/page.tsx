import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/product/ProductGrid';
import { Breadcrumbs } from '@/components/product/Breadcrumbs';
import { Container } from '@/components/ui/Container';
import { getCategories, getProducts } from '@/lib/catalog';
import { siteConfig } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = (await getCategories()).find((c) => c.slug === slug);
  return category ? { title: `${category.name} — ${siteConfig.name}`, description: category.description || siteConfig.description } : {};
}

/** One category's kits. */
export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const products = await getProducts(slug);

  return (
    <section aria-labelledby="category-title" className="pb-section pt-6 md:pt-8">
      <Container>
        <Breadcrumbs items={[{ label: 'Home', href: '/' }, { label: 'Shop', href: '/shop' }, { label: category.name }]} />
        <h1 id="category-title" className="headline mt-6 text-[clamp(2.75rem,6vw,4.5rem)]">
          {category.name}
        </h1>
        {category.description && <p className="mt-2 max-w-xl text-sm text-ink/60">{category.description}</p>}
        <div className="mt-8">
          <ProductGrid products={products} categories={categories} activeSlug={slug} />
        </div>
      </Container>
    </section>
  );
}
