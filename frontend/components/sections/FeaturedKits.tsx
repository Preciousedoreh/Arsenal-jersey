'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';

export interface KitTile {
  label: string;
  image: string;
  href: string;
}

/** Horizontal, snap-scrolling row of square kit tiles with a "next" button. Each tile opens its category. */
export function FeaturedKits({ tiles }: { tiles: KitTile[] }) {
  const scroller = useRef<HTMLUListElement>(null);

  const scrollNext = () => {
    const el = scroller.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    el.scrollTo({ left: atEnd ? 0 : el.scrollLeft + el.clientWidth * 0.8, behavior: 'smooth' });
  };

  if (tiles.length === 0) return null;
  return (
    <section id="featured-kits" aria-labelledby="featured-kits-title" className="py-12 md:py-14">
      <Container>
        <SectionHeading id="featured-kits-title" title="Featured kits" small />
        <div className="relative">
          <ul ref={scroller} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {tiles.map((tile) => (
              <li key={tile.href} className="w-[42%] shrink-0 snap-start sm:w-[30%] lg:w-[calc((100%-4rem)/5)]">
                <Link href={tile.href} className="group block">
                  <div className="relative aspect-square overflow-hidden border border-line bg-white transition-colors group-hover:border-primary">
                    <Image src={tile.image} alt="" fill sizes="(min-width: 1024px) 20vw, 40vw" className="object-contain p-[14%] transition-transform duration-500 ease-out-expo group-hover:scale-105" />
                  </div>
                  <p className="eyebrow mt-3 transition-colors group-hover:text-primary">{tile.label}</p>
                </Link>
              </li>
            ))}
          </ul>
          {tiles.length > 5 && (
            <button
              type="button"
              onClick={scrollNext}
              aria-label="Scroll featured kits"
              className="absolute -right-3 top-[calc(50%-1rem)] hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-line bg-white shadow-md transition-colors hover:border-primary hover:text-primary md:grid"
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
          )}
        </div>
      </Container>
    </section>
  );
}
