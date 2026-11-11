import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/product/ProductDetail';
import { ProductReviews } from '@/components/product/ProductReviews';
import { RelatedProducts } from '@/components/product/RelatedProducts';
import { getProductBySlug, getProducts, relatedProducts } from '@/lib/catalog';
import { sanitizeName, sanitizeNumber } from '@/lib/personalisation';
import { siteConfig } from '@/lib/site';

interface PageProps {
  params: Promise<{ slug: string }>;
  /** `?name=RAY&number=10` pre-fills the personalisation (used by the home-page customizer). */
  searchParams: Promise<{ name?: string; number?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  return {
    title: `${product.name} — ${siteConfig.name}`,
    description: product.description,
    openGraph: { title: `${product.name} — ${siteConfig.name}`, description: product.description, images: product.images.slice(0, 1) as string[] },
  };
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const query = await searchParams;
  const initialPrint =
    product.customizable && (query.name || query.number)
      ? { name: sanitizeName(query.name ?? ''), number: sanitizeNumber(query.number ?? '') }
      : null;

  const related = relatedProducts(product, await getProducts());

  // Structured data so search engines can show price and availability.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    sku: product.sku,
    image: product.images,
    ...(product.reviewCount > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.rating, reviewCount: product.reviewCount } } : {}),
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: 'USD',
      availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // `<` is escaped so the JSON can never close the script tag early.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <ProductDetail product={product} initialPrint={initialPrint} />
      {product.reviewCount > 0 && <ProductReviews product={product} />}
      <RelatedProducts products={related} />
    </>
  );
}
