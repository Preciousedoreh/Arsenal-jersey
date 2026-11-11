'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Calendar, ShieldCheck, Tag } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/ui/Container';
import { images } from '@/data/images';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { cn, formatPrice } from '@/lib/utils';
import { siteConfig } from '@/lib/site';

const AUTOPLAY_MS = 6000;
const EASE = [0.16, 1, 0.3, 1] as const;

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: [string, string];
  image: string;
  price: number;
  alt: string;
}

/** Auto-advancing hero carousel. Pauses on hover/focus and when the user prefers reduced motion. */
export function Hero({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const count = slides.length;
  const slide = slides[index]!;

  const go = useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count]);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = setTimeout(() => go(1), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, paused, reducedMotion, go]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured collections"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={onKeyDown}
      className="relative overflow-hidden bg-surface"
    >
      <Image src={images.scenes.hero} alt="" fill priority sizes="100vw" className="object-cover opacity-70" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-surface via-surface/85 to-surface/10" />

      <Container className="relative">
        <div className="grid min-h-[560px] items-center gap-8 pb-20 pt-12 md:min-h-[620px] md:grid-cols-[1.05fr_1fr] md:pt-8">
          {/* Copy */}
          <div aria-live={paused ? 'polite' : 'off'}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <p className="eyebrow text-primary">{slide.eyebrow}</p>
                <h1 className="headline mt-4 text-[clamp(3.5rem,9vw,7rem)]">
                  {slide.title[0]}
                  <br />
                  {slide.title[1]}
                </h1>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button href="#new-season" arrow>
                    Shop new kits
                  </Button>
                  <Button href="#categories" variant="secondary">
                    Explore collection
                  </Button>
                </div>
                <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-micro font-medium uppercase tracking-label text-ink/60">
                  <li className="flex items-center gap-1.5">
                    <ShieldCheck aria-hidden className="size-3.5 text-gold" /> Official kit
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Calendar aria-hidden className="size-3.5 text-gold" /> {siteConfig.currentYear}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Tag aria-hidden className="size-3.5 text-gold" /> {formatPrice(slide.price)}
                  </li>
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Kit */}
          <div className="relative mx-auto aspect-[10/11] w-full max-w-[520px]">
            <span aria-hidden className="headline pointer-events-none absolute -right-4 bottom-0 select-none text-[clamp(6rem,16vw,12rem)] text-ink/[0.06]">
              {siteConfig.currentYear}
            </span>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={slide.id}
                className="absolute inset-0"
                initial={{ opacity: 0, x: 40, rotate: 2 }}
                animate={{ opacity: 1, x: 0, rotate: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.6, ease: EASE }}
              >
                <Image src={slide.image} alt={slide.alt} fill priority={index === 0} sizes="(min-width: 768px) 520px, 90vw" className="object-contain drop-shadow-2xl" />
              </motion.div>
            </AnimatePresence>
            <Badge tone="gold" className="absolute left-[12%] top-[6%]">
              New drop
            </Badge>
            <div className="absolute bottom-[22%] right-[4%] grid size-16 place-items-center rounded-full bg-primary text-sm font-bold text-white shadow-lg ring-4 ring-white md:size-20 md:text-base">
              {formatPrice(slide.price)}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="absolute inset-x-4 bottom-6 flex items-center justify-between sm:inset-x-6 lg:inset-x-8">
          <div className="flex items-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className="grid h-6 place-items-center"
              >
                <span className={cn('block h-1.5 rounded-full transition-all duration-300', i === index ? 'w-6 bg-primary' : 'w-1.5 bg-ink/25 hover:bg-ink/50')} />
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => go(-1)} aria-label="Previous slide" className="grid size-9 place-items-center rounded-full border border-ink/15 bg-white transition-colors hover:border-primary hover:text-primary">
              <ArrowLeft aria-hidden className="size-4" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next slide" className="grid size-9 place-items-center rounded-full border border-ink/15 bg-white transition-colors hover:border-primary hover:text-primary">
              <ArrowRight aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      </Container>
    </section>
  );
}
