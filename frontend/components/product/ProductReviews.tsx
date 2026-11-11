import { BadgeCheck } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { StarRating } from '@/components/ui/StarRating';
import { testimonials } from '@/data/testimonials';
import { ratingDistribution } from '@/lib/ratings';
import type { Product } from '@/types';

const SHOWN_REVIEWS = 3;

/** Rating summary with a star breakdown, plus a few recent reviews (mock data). */
export function ProductReviews({ product }: { product: Product }) {
  const distribution = ratingDistribution(product.rating);

  return (
    <section id="reviews" aria-labelledby="reviews-title" className="bg-surface py-section">
      <Container>
        <h2 id="reviews-title" className="headline text-3xl md:text-4xl">
          Customer reviews
        </h2>

        <div className="mt-8 grid gap-10 lg:grid-cols-[20rem_1fr] lg:gap-16">
          <div>
            <p className="flex items-end gap-3">
              <span className="headline text-7xl">{product.rating.toFixed(1)}</span>
              <span className="pb-2 text-sm text-muted">out of 5</span>
            </p>
            <StarRating rating={product.rating} size="md" className="mt-2" />
            <p className="mt-2 text-sm text-ink/70">Based on {product.reviewCount} reviews</p>

            <ul className="mt-6 space-y-2" aria-label="Rating breakdown">
              {distribution.map((percent, i) => {
                const stars = 5 - i;
                return (
                  <li key={stars} className="flex items-center gap-3 text-micro">
                    <span className="w-10 shrink-0 font-medium">{stars} star</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                      <span className="block h-full rounded-full bg-gold" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="w-9 shrink-0 text-right tabular-nums text-muted">{percent}%</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <ul className="grid gap-4 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {testimonials.slice(0, SHOWN_REVIEWS).map((review) => (
              <li key={review.id}>
                <figure className="h-full border border-line bg-white p-5">
                  <StarRating rating={review.rating} />
                  <blockquote className="mt-3 text-sm leading-relaxed text-ink/80">“{review.quote}”</blockquote>
                  <figcaption className="mt-4 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{review.name}</span>
                    <span className="flex items-center gap-1 text-tiny font-medium uppercase tracking-label text-gold">
                      <BadgeCheck aria-hidden className="size-3" /> Verified fan
                    </span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
