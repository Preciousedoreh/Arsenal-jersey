import { Container } from '@/components/ui/Container';
import { ProductCard } from '@/components/ui/ProductCard';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { Product } from '@/types';

/** "You may also like": other kits, same category first (chosen by the page). */
export function RelatedProducts({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="related-title" className="py-section">
      <Container>
        <SectionHeading id="related-title" title="You may also like" viewAllHref="/shop" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-6">
          {products.map((related) => (
            <ProductCard key={related.id} product={related} variant="compact" />
          ))}
        </div>
      </Container>
    </section>
  );
}
