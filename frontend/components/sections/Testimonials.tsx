'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Quote } from 'lucide-react';
import { Container } from '@/components/ui/Container';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StarRating } from '@/components/ui/StarRating';
import { testimonials } from '@/data/testimonials';
import { cn } from '@/lib/utils';

/**
 * Scroll-snap carousel: one card per page on mobile, three on desktop. The dots reflect the
 * current page and jump to a page when clicked; swipe/scroll and keyboard scrolling work natively.
 */
export function Testimonials() {
  const track = useRef<HTMLUListElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setPages(Math.max(1, Math.round(el.scrollWidth / el.clientWidth)));
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const goTo = (i: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <section aria-labelledby="testimonials-title" className="bg-surface py-section">
      <Container>
        <SectionHeading id="testimonials-title" title="Customer love" />
        <ul
          ref={track}
          onScroll={measure}
          tabIndex={0}
          aria-label="Customer reviews"
          className="no-scrollbar relative -mx-2 flex snap-x snap-mandatory overflow-x-auto focus-visible:outline-offset-4"
        >
          {testimonials.map((t) => (
            <li key={t.id} className="w-full shrink-0 snap-start px-2 md:w-1/3">
              <figure className="flex h-full flex-col border border-line bg-white p-6 transition-shadow hover:shadow-md">
                <div className="flex items-center justify-between">
                  <StarRating rating={t.rating} />
                  <Quote aria-hidden className="size-5 text-primary/20" />
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-ink/80">“{t.quote}”</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <Image src={t.avatar} alt="" width={40} height={40} className="size-10 rounded-full" />
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="flex items-center gap-1 text-tiny font-medium uppercase tracking-label text-gold">
                      <BadgeCheck aria-hidden className="size-3" /> Verified fan
                    </p>
                  </div>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
        {pages > 1 && (
          <div className="mt-6 flex justify-center gap-2">
            {Array.from({ length: pages }, (_, i) => (
              <button key={i} type="button" onClick={() => goTo(i)} aria-label={`Show reviews page ${i + 1}`} aria-current={i === page} className="grid h-6 place-items-center">
                <span className={cn('block h-1.5 rounded-full transition-all duration-300', i === page ? 'w-6 bg-primary' : 'w-1.5 bg-ink/25 hover:bg-ink/50')} />
              </button>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
