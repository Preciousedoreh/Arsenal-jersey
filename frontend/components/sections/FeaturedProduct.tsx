'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ShieldCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { CrestPlaceholder } from '@/components/ui/Brand';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { StarRating } from '@/components/ui/StarRating';
import { MAX_LINE_QUANTITY, useCart } from '@/lib/cart-store';
import { cn, formatPrice } from '@/lib/utils';
import type { Product, Size } from '@/types';

const ADDED_FEEDBACK_MS = 1800;
const sizeLabel = (size: Size) => (size === 'OS' ? 'One size' : size);

/**
 * Inline product block on the home page. The swatches switch between the featured kits (home / away /
 * third…); sizes, price and stock always belong to the kit being shown.
 */
export function FeaturedProduct({ products }: { products: Product[] }) {
  const add = useCart((s) => s.add);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState<Size | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'needs-size' | 'added'>('idle');

  const product = products[index]!;
  const image = product.images[0] ?? '';
  const colour = product.colors[0];
  const sizeStock = product.sizes.find((s) => s.size === size)?.stock ?? 0;

  const pickKit = (i: number) => {
    setIndex(i);
    setSize(null); // sizes and stock differ per kit
    setQuantity(1);
    setStatus('idle');
  };

  const addToCart = () => {
    if (!size) {
      setStatus('needs-size');
      return;
    }
    add({ productId: product.id, name: product.name, price: product.price, image, size, color: colour?.name, quantity });
    setStatus('added');
    setTimeout(() => setStatus('idle'), ADDED_FEEDBACK_MS);
  };

  return (
    <section aria-labelledby="featured-product-title" className="pb-section">
      <Container>
        <div className="grid gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden bg-surface">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={image} className="absolute inset-0" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                <Image src={image} alt={`${product.subtitle ?? product.name}${colour ? ` in ${colour.name}` : ''}`} fill sizes="(min-width: 768px) 50vw, 100vw" className="object-contain p-[12%]" />
              </motion.div>
            </AnimatePresence>
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <CrestPlaceholder className="h-7 w-auto text-primary" />
              <span className="text-tiny font-semibold uppercase leading-tight tracking-label text-ink/60">
                Official licensed
                <br />
                product
              </span>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-col justify-center">
            <h2 id="featured-product-title" className="headline text-4xl md:text-5xl">
              {product.subtitle ?? product.name}
            </h2>
            <p className="mt-3 text-2xl font-bold">{formatPrice(product.price)}</p>
            {product.rating > 0 && <StarRating rating={product.rating} label={`(${product.rating})`} size="md" className="mt-3" />}
            <Link href={`/products/${product.slug}`} className="eyebrow mt-3 w-fit text-ink underline underline-offset-4 transition-colors hover:text-primary">
              View full details
            </Link>

            <fieldset className="mt-8">
              <legend className="eyebrow text-ink/60">Select size</legend>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <label key={s.size} className={cn('cursor-pointer', s.stock === 0 && 'cursor-not-allowed')}>
                    <input
                      type="radio"
                      name="featured-size"
                      value={s.size}
                      checked={size === s.size}
                      disabled={s.stock === 0}
                      onChange={() => {
                        setSize(s.size);
                        setQuantity(1);
                        setStatus('idle');
                      }}
                      className="peer sr-only"
                    />
                    <span
                      className={cn(
                        'grid h-10 min-w-12 place-items-center rounded-btn border border-line px-3 text-micro font-semibold transition-colors hover:border-ink',
                        'peer-checked:border-primary peer-checked:bg-primary peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-primary',
                        s.stock === 0 && 'border-dashed text-ink/30 line-through hover:border-line',
                      )}
                    >
                      {sizeLabel(s.size)}
                    </span>
                  </label>
                ))}
              </div>
              {status === 'needs-size' && (
                <p role="alert" className="mt-2 text-micro font-medium text-primary">
                  Please choose a size.
                </p>
              )}
            </fieldset>

            {products.length > 1 && (
              <fieldset className="mt-6">
                <legend className="eyebrow text-ink/60">
                  Kit <span className="normal-case tracking-normal text-ink">— {colour?.name ?? product.name}</span>
                </legend>
                <div className="mt-3 flex gap-3">
                  {products.map((p, i) => (
                    <label key={p.id} className="cursor-pointer" title={p.colors[0]?.name ?? p.name}>
                      <input type="radio" name="featured-kit" value={p.id} checked={i === index} onChange={() => pickKit(i)} className="peer sr-only" aria-label={p.colors[0]?.name ?? p.name} />
                      <span
                        className="block size-8 rounded-full border border-ink/15 ring-offset-2 transition-shadow peer-checked:ring-2 peer-checked:ring-primary peer-focus-visible:ring-2 peer-focus-visible:ring-gold"
                        style={{ backgroundColor: p.colors[0]?.hex ?? '#ccc' }}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="mt-6">
              <p className="eyebrow text-ink/60">Quantity</p>
              <div className="mt-3">
                <QuantityStepper value={quantity} onChange={setQuantity} max={size ? Math.max(1, Math.min(MAX_LINE_QUANTITY, sizeStock)) : MAX_LINE_QUANTITY} />
              </div>
            </div>

            <Button onClick={addToCart} disabled={product.stock === 0} arrow={status !== 'added'} fullWidth className={cn('mt-8 h-12', status === 'added' && 'bg-ink hover:bg-ink')}>
              {product.stock === 0 ? (
                'Sold out'
              ) : status === 'added' ? (
                <>
                  <Check aria-hidden className="size-4" /> Added to cart
                </>
              ) : (
                'Add to cart'
              )}
            </Button>
            <p aria-live="polite" className="sr-only">
              {status === 'added' ? `${quantity} × ${product.name}, size ${size}, added to cart` : ''}
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-micro text-ink/70">
              <li className="flex items-center gap-2">
                <ShieldCheck aria-hidden className="size-4 text-gold" /> Authentic merchandise
              </li>
              <li className="flex items-center gap-2">
                <Truck aria-hidden className="size-4 text-gold" /> Fast worldwide delivery
              </li>
            </ul>
          </div>
        </div>
      </Container>
    </section>
  );
}
