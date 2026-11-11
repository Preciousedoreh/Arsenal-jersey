'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { Product } from '@/types';

/** Accessible names for the three gallery images, in the order of Product.images. */
export const GALLERY_LABELS = ['Front view', 'Back view', 'Crest and collar detail'] as const;
export const BACK_INDEX = 1;
/** The print preview is calibrated for the bundled back-view artwork; real photos just show without it. */
const PREVIEWABLE_BACK = /-back.svg$/;
const SWIPE_THRESHOLD_PX = 40;

export interface PrintPreview {
  name: string;
  number: string;
  /** CSS colour of the lettering. */
  color: string;
}

interface ProductGalleryProps {
  product: Product;
  index: number;
  onIndexChange: (index: number) => void;
  /** When set, the name and number are drawn on the back view. */
  print: PrintPreview | null;
  wishlisted: boolean;
  onToggleWishlist: () => void;
}

/**
 * Image gallery: large stage with hover zoom, arrows, swipe and ←/→ keys, plus thumbnails
 * (a column on desktop, a row on mobile). Shows the live name & number print on the back view.
 */
export function ProductGallery({ product, index, onIndexChange, print, wishlisted, onToggleWishlist }: ProductGalleryProps) {
  const count = product.images.length;
  const [zoomOrigin, setZoomOrigin] = useState('50% 50%');
  const touchStartX = useRef<number | null>(null);

  const go = (delta: number) => onIndexChange((index + delta + count) % count);
  const src = product.images[index]!;
  const label = GALLERY_LABELS[index] ?? `Image ${index + 1}`;

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-[5.5rem_minmax(0,1fr)] lg:gap-4">
      <ul aria-label="Choose an image" className="order-2 mt-3 flex gap-3 lg:order-1 lg:mt-0 lg:flex-col">
        {product.images.map((image, i) => (
          <li key={image} className="w-20 shrink-0 lg:w-full">
            <button
              type="button"
              onClick={() => onIndexChange(i)}
              aria-label={`Show ${GALLERY_LABELS[i] ?? `image ${i + 1}`}`}
              aria-current={i === index}
              className={cn(
                'relative block aspect-square w-full overflow-hidden border-2 bg-surface transition-colors',
                i === index ? 'border-primary' : 'border-transparent hover:border-ink/25',
              )}
            >
              <Image src={image} alt="" fill priority sizes="88px" className="object-contain p-1.5" />
            </button>
          </li>
        ))}
      </ul>

      <div
        role="group"
        aria-roledescription="carousel"
        aria-label={`${product.name} images`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(-1);
          if (e.key === 'ArrowRight') go(1);
        }}
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          const end = e.changedTouches[0]?.clientX;
          if (start === null || end === undefined) return;
          if (Math.abs(end - start) > SWIPE_THRESHOLD_PX) go(end < start ? 1 : -1);
        }}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setZoomOrigin(`${((e.clientX - box.left) / box.width) * 100}% ${((e.clientY - box.top) / box.height) * 100}%`);
        }}
        // `@container` lets the print lettering scale with the stage (cqw units).
        className="group @container relative order-1 aspect-[10/11] cursor-zoom-in overflow-hidden bg-surface lg:order-2"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ transformOrigin: zoomOrigin }}
            className="absolute inset-0 transition-transform duration-300 ease-out group-hover:scale-[1.7]"
          >
            <Image
              src={src}
              alt={`${product.name} — ${label.toLowerCase()}`}
              fill
              priority={index === 0}
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-contain"
            />
            {print && index === BACK_INDEX && PREVIEWABLE_BACK.test(src) && (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[21%] flex flex-col items-center text-center" style={{ color: print.color }}>
                <span className="font-display text-[7.5cqw] uppercase leading-none tracking-[0.12em]">{print.name}</span>
                <span className="mt-[2cqw] font-display text-[34cqw] leading-[0.85]">{print.number}</span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {product.badge && (
          <Badge tone={product.badge === 'LIMITED' ? 'gold' : 'red'} className="absolute left-4 top-4">
            {product.badge === 'LIMITED' ? 'Limited' : 'New in'}
          </Badge>
        )}
        <button
          type="button"
          onClick={onToggleWishlist}
          aria-pressed={wishlisted}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          className="absolute right-4 top-4 grid size-10 cursor-pointer place-items-center rounded-full bg-white/90 shadow-sm transition-colors hover:text-primary"
        >
          <Heart aria-hidden className={cn('size-[18px]', wishlisted && 'fill-primary text-primary')} />
        </button>

        <button type="button" onClick={() => go(-1)} aria-label="Previous image" className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/90 shadow-sm transition-colors hover:text-primary">
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <button type="button" onClick={() => go(1)} aria-label="Next image" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/90 shadow-sm transition-colors hover:text-primary">
          <ChevronRight aria-hidden className="size-5" />
        </button>

        <p aria-live="polite" className="absolute bottom-3 right-4 text-tiny font-semibold uppercase tracking-label text-ink/50">
          <span className="sr-only">{label}. </span>
          {index + 1} / {count}
        </p>
      </div>
    </div>
  );
}
