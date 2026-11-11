import { Container } from '@/components/ui/Container';
import { ProductCard } from '@/components/ui/ProductCard';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { Product } from '@/types';

const STAGGER_S = 0.08;

/** Large product cards for the newest kits. */
export function NewCollection({ products }: { products: Product[] }) {
  return (
    <section id="new-season" aria-labelledby="new-season-title" className="py-section">
      <Container>
        <SectionHeading id="new-season-title" title="New season collection" viewAllHref="/shop" />
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8">
          {products.map((product, i) => (
            <Reveal key={product.id} delay={i * STAGGER_S}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
