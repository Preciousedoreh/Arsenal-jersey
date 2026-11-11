import { Container } from '@/components/ui/Container';
import { ProductCard } from '@/components/ui/ProductCard';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { Product } from '@/types';

const STAGGER_S = 0.06;

/** Compact cards with wishlist, rating and quick add-to-cart. */
export function BestSellers({ products }: { products: Product[] }) {
  return (
    <section id="best-sellers" aria-labelledby="best-sellers-title" className="py-section">
      <Container>
        <SectionHeading id="best-sellers-title" title="Best sellers" viewAllHref="/shop" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4 lg:gap-6">
          {products.map((product, i) => (
            <Reveal key={product.id} delay={i * STAGGER_S}>
              <ProductCard product={product} variant="compact" />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
