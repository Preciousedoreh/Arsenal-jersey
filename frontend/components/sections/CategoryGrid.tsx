import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { categoryHref } from '@/lib/site';
import type { Category } from '@/types';

const STAGGER_S = 0.06;

/** Tall photo tiles, one per category that has products. The photo zooms on hover. */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  const tiles = categories.filter((c) => c.productCount > 0 && c.image);
  if (tiles.length === 0) return null;
  return (
    <section id="categories" aria-labelledby="categories-title" className="pb-section">
      <Container>
        <SectionHeading id="categories-title" title="Shop by category" />
        <ul className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] sm:overflow-visible sm:px-0">
          {tiles.map((category, i) => (
            <li key={category.id} className="w-[62%] shrink-0 snap-start sm:w-auto">
              <Reveal delay={i * STAGGER_S}>
                <Link href={categoryHref(category.slug)} className="group relative block aspect-[3/4] overflow-hidden bg-ink">
                  <Image
                    src={category.image!}
                    alt={`${category.name} category`}
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 62vw"
                    className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-110"
                  />
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-primary transition-transform duration-300 group-hover:scale-x-100" />
                  <span className="eyebrow absolute bottom-4 left-4 flex items-center gap-1.5 text-white">
                    {category.name}
                    <ArrowRight aria-hidden className="size-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
