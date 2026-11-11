import { Hero, type HeroSlide } from '@/components/sections/Hero';
import { FeaturedKits, type KitTile } from '@/components/sections/FeaturedKits';
import { NewCollection } from '@/components/sections/NewCollection';
import { CategoryGrid } from '@/components/sections/CategoryGrid';
import { FeaturedProduct } from '@/components/sections/FeaturedProduct';
import { MatchdayBanner } from '@/components/sections/MatchdayBanner';
import { BestSellers } from '@/components/sections/BestSellers';
import { CraftStrip } from '@/components/sections/CraftStrip';
import { DividerStrip } from '@/components/sections/DividerStrip';
import { Customizer, type CustomizerTargets } from '@/components/sections/Customizer';
import { LimitedEdition } from '@/components/sections/LimitedEdition';
import { MomentBanner } from '@/components/sections/MomentBanner';
import { Testimonials } from '@/components/sections/Testimonials';
import { Newsletter } from '@/components/sections/Newsletter';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { getCategories, getProducts } from '@/lib/catalog';
import { categoryHref } from '@/lib/site';
import type { Product } from '@/types';

/** Marketing copy for the hero slides (the products behind them come from the catalogue). */
const HERO_COPY: { eyebrow: string; title: [string, string] }[] = [
  { eyebrow: '2026 Match Collection', title: ['Wear', 'the game.'] },
  { eyebrow: '2026 Away Collection', title: ['Own', 'the road.'] },
  { eyebrow: '2026 Third Collection', title: ['Black.', 'Gold. Glory.'] },
];

/** Prefer products marked for a section; fall back to whatever exists so no section is ever empty. */
const pick = (marked: Product[], all: Product[], count: number) => (marked.length > 0 ? marked : all).slice(0, count);

/**
 * Home page. What appears where is controlled from the admin: the "NEW" badge feeds New Season and the
 * hero, "Best seller" feeds Best Sellers, "Featured" leads the inline product block, and the
 * "LIMITED" badge feeds the Limited Edition banner.
 */
export default async function HomePage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);

  if (products.length === 0) {
    return (
      <Container className="py-24 text-center">
        <h1 className="headline text-5xl">The shop is being stocked</h1>
        <p className="mt-4 text-sm text-ink/70">Kits will appear here as soon as they are added in the admin.</p>
        <Button href="/checkout" variant="secondary" className="mt-8">
          Go to checkout
        </Button>
      </Container>
    );
  }

  const newSeason = pick(products.filter((p) => p.badge === 'NEW'), products, 3);
  const bestSellers = pick(products.filter((p) => p.isBestSeller), products, 4);
  const featured = products.find((p) => p.isFeatured) ?? newSeason[0]!;
  const featuredKits = [featured, ...newSeason.filter((p) => p.id !== featured.id)].slice(0, 4);
  const limited = products.find((p) => p.badge === 'LIMITED');

  const heroSlides: HeroSlide[] = newSeason.slice(0, HERO_COPY.length).map((p, i) => ({
    id: p.id,
    eyebrow: HERO_COPY[i]!.eyebrow,
    title: HERO_COPY[i]!.title,
    image: p.images[0] ?? '',
    price: p.price,
    alt: p.name,
  }));

  // One tile per category that has kits, showing its first kit.
  const kitTiles: KitTile[] = categories.flatMap((c) => {
    const first = products.find((p) => p.category === c.slug);
    return first?.images[0] ? [{ label: c.name, image: first.images[0], href: categoryHref(c.slug) }] : [];
  });

  const firstCustomizable = (category: string) => products.find((p) => p.category === category && p.customizable && p.badge !== 'LIMITED');
  const customizerTargets: CustomizerTargets = {
    red: firstCustomizable('home-kits'),
    white: firstCustomizable('away-kits'),
    black: firstCustomizable('third-kits'),
  };

  return (
    <>
      <Hero slides={heroSlides} />
      <FeaturedKits tiles={kitTiles} />
      <NewCollection products={newSeason} />
      <CategoryGrid categories={categories} />
      <FeaturedProduct products={featuredKits} />
      <MatchdayBanner />
      <BestSellers products={bestSellers} />
      <CraftStrip />
      <DividerStrip />
      <Customizer targets={customizerTargets} />
      {limited && <LimitedEdition product={limited} />}
      <MomentBanner />
      <Testimonials />
      <Newsletter />
    </>
  );
}
