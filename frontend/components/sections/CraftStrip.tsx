import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/ui/Reveal';
import { craftTiles } from '@/data/craft';

const STAGGER_S = 0.08;

/** Three macro-texture tiles showing the craft behind the kits. */
export function CraftStrip() {
  return (
    <section aria-label="Craftsmanship" className="pb-section">
      <Container>
        <ul className="grid gap-3 md:grid-cols-3">
          {craftTiles.map((tile, i) => (
            <li key={tile.label}>
              <Reveal delay={i * STAGGER_S} className="group relative aspect-[16/9] overflow-hidden bg-ink">
                <Image src={tile.image} alt={tile.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover transition-transform duration-700 ease-out-expo group-hover:scale-105" />
                <span className="eyebrow absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-ink/90 to-transparent px-4 pb-3 pt-10 text-white">
                  <span aria-hidden className="h-px w-5 bg-gold-light" />
                  {tile.label}
                </span>
              </Reveal>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
