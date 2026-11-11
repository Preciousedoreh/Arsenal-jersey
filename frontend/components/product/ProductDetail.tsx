'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2, Heart, RotateCcw, ShieldCheck, Truck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { StarRating } from '@/components/ui/StarRating';
import { MAX_LINE_QUANTITY, useCart } from '@/lib/cart-store';
import { FREE_DELIVERY_THRESHOLD } from '@/lib/checkout';
import { NAME_MAX, NUMBER_MAX, sanitizeName, sanitizeNumber } from '@/lib/personalisation';
import { cn, formatPrice, formatPriceExact } from '@/lib/utils';
import type { Product, Size } from '@/types';
import { Breadcrumbs } from './Breadcrumbs';
import { ProductAccordion } from './ProductAccordion';
import { BACK_INDEX, ProductGallery } from './ProductGallery';
import { SizeGuide } from './SizeGuide';

type Status = 'idle' | 'needs-size' | 'needs-print' | 'added';

const LOW_STOCK_AT = 10;

const trust = [
  { Icon: ShieldCheck, text: 'Authentic, officially licensed' },
  { Icon: Truck, text: `Free delivery over $${FREE_DELIVERY_THRESHOLD}` },
  { Icon: RotateCcw, text: '30-day returns on unworn kits' },
] as const;

/** Smooth-scroll unless the visitor prefers reduced motion. */
function scrollToCentre(el: Element | null) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
}

/** The top half of the product page: gallery + buying panel (size, personalisation, quantity, cart). */
export function ProductDetail({ product, initialPrint }: { product: Product; initialPrint?: { name: string; number: string } | null }) {
  const router = useRouter();
  const add = useCart((s) => s.add);

  const [imageIndex, setImageIndex] = useState(initialPrint && product.images.length > BACK_INDEX ? BACK_INDEX : 0);
  const [size, setSize] = useState<Size | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [personalise, setPersonalise] = useState(Boolean(initialPrint));
  const [printName, setPrintName] = useState(initialPrint?.name ?? '');
  const [printNumber, setPrintNumber] = useState(initialPrint?.number ?? '');
  const [wishlisted, setWishlisted] = useState(false);
  const [status, setStatus] = useState<Status>('idle');

  const nameId = useId();
  const numberId = useId();
  const sizeRef = useRef<HTMLFieldSetElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Mobile sticky bar: show while this product section is on screen but the main buttons are not.
  const [ctaVisible, setCtaVisible] = useState(true);
  const [sectionVisible, setSectionVisible] = useState(true);
  useEffect(() => {
    const cta = ctaRef.current;
    const section = sectionRef.current;
    if (!cta || !section) return;
    const ctaObserver = new IntersectionObserver(([entry]) => setCtaVisible(entry?.isIntersecting ?? true));
    const sectionObserver = new IntersectionObserver(([entry]) => setSectionVisible(entry?.isIntersecting ?? true));
    ctaObserver.observe(cta);
    sectionObserver.observe(section);
    return () => {
      ctaObserver.disconnect();
      sectionObserver.disconnect();
    };
  }, []);
  const showStickyBar = !ctaVisible && sectionVisible;

  const soldOut = product.stock <= 0;
  const selectedStock = product.sizes.find((s) => s.size === size)?.stock ?? 0;
  /** Stock the label talks about: the chosen size once one is picked, otherwise all sizes together. */
  const shownStock = size ? selectedStock : product.stock;
  const maxQuantity = Math.max(1, Math.min(MAX_LINE_QUANTITY, size ? selectedStock : MAX_LINE_QUANTITY));
  const hasRealSizes = product.sizes.some((s) => s.size !== 'OS');
  const unitPrice = product.price + (personalise ? product.printPrice : 0);
  const total = unitPrice * quantity;
  const colour = product.colors[0];

  // Any change to the choices clears a previous error or "added" notice.
  const edit =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setStatus('idle');
    };

  const addToCart = (): boolean => {
    if (!size) {
      setStatus('needs-size');
      scrollToCentre(sizeRef.current);
      sizeRef.current?.querySelector('input')?.focus({ preventScroll: true });
      return false;
    }
    if (personalise && !printName.trim() && !printNumber) {
      setStatus('needs-print');
      scrollToCentre(printRef.current);
      return false;
    }
    add({
      productId: product.id,
      name: product.name,
      price: unitPrice,
      image: product.images[0]!,
      size,
      color: colour?.name,
      quantity,
      customization: personalise ? { name: printName.trim(), number: printNumber } : undefined,
    });
    setStatus('added');
    return true;
  };

  const buyNow = () => {
    // `status === 'added'` means these exact choices are already in the cart.
    if (status === 'added' || addToCart()) router.push('/checkout');
  };

  const stockLabel = shownStock <= 0 ? 'Sold out' : shownStock <= LOW_STOCK_AT ? `Only ${shownStock} left` : 'In stock';

  return (
    <section ref={sectionRef} aria-labelledby="product-title" className="pb-section pt-6 md:pt-8">
      <Container>
        <Breadcrumbs
          items={[
            { label: 'Home', href: '/' },
            { label: 'Shop', href: '/#new-season' },
            { label: product.categoryName, href: '/#categories' },
            { label: product.name },
          ]}
        />

        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <ProductGallery
              product={product}
              index={imageIndex}
              onIndexChange={setImageIndex}
              print={
                personalise
                  ? { name: printName.trim() || 'YOUR NAME', number: printNumber || '10', color: product.printColor ?? '#FFFFFF' }
                  : null
              }
              wishlisted={wishlisted}
              onToggleWishlist={() => setWishlisted((w) => !w)}
            />
          </div>

          <div>
            <p className="eyebrow text-primary">{product.categoryName}</p>
            <h1 id="product-title" className="headline mt-2 text-[clamp(2.5rem,5vw,3.75rem)]">
              {product.name}
            </h1>
            {product.subtitle && <p className="mt-1 text-sm text-muted">{product.subtitle}</p>}

            {product.reviewCount > 0 && (
              <a href="#reviews" className="mt-4 inline-flex items-center gap-2 text-sm text-ink/70 hover:text-primary">
                <StarRating rating={product.rating} size="md" />
                <span className="underline underline-offset-2">
                  {product.rating} · {product.reviewCount} reviews
                </span>
              </a>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="text-3xl font-bold tabular-nums">{formatPrice(product.price)}</p>
              <p
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-tiny font-bold uppercase tracking-label',
                  shownStock <= 0 ? 'border-ink/20 text-ink/60' : shownStock <= LOW_STOCK_AT ? 'border-primary/30 bg-primary/5 text-primary' : 'border-emerald-700/25 bg-emerald-50 text-emerald-800',
                )}
              >
                <span aria-hidden className={cn('size-1.5 rounded-full', shownStock <= 0 ? 'bg-ink/40' : shownStock <= LOW_STOCK_AT ? 'bg-primary' : 'bg-emerald-600')} />
                {stockLabel}
              </p>
            </div>

            <p className="mt-5 max-w-xl text-sm leading-relaxed text-ink/75">{product.description}</p>
            <ul className="mt-4 space-y-2">
              {product.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-ink/80">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-gold" strokeWidth={3} />
                  {feature}
                </li>
              ))}
            </ul>

            {colour && (
              <p className="mt-6 flex items-center gap-2.5 text-sm">
                <span className="eyebrow text-ink/60">Colour</span>
                <span aria-hidden className="size-4 rounded-full border border-ink/15" style={{ backgroundColor: colour.hex }} />
                <span className="font-medium">{colour.name}</span>
              </p>
            )}

            {/* Size */}
            <fieldset ref={sizeRef} className="mt-6" aria-describedby={status === 'needs-size' ? 'size-error' : undefined}>
              <div className="flex items-center justify-between">
                <legend className="eyebrow text-ink/60">
                  {hasRealSizes ? 'Size' : 'Option'} {size && <span className="normal-case tracking-normal text-ink">— {size === 'OS' ? 'One size' : size}</span>}
                </legend>
                {hasRealSizes && <SizeGuide />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.sizes.map(({ size: s, stock }) => (
                  <label
                    key={s}
                    className={cn(
                      'grid h-11 min-w-14 cursor-pointer place-items-center border border-ink/25 px-4 text-sm font-semibold transition-colors hover:border-ink',
                      stock === 0 && 'cursor-not-allowed border-dashed text-ink/30 line-through hover:border-ink/25',
                      'has-checked:border-primary has-checked:bg-primary has-checked:text-white',
                      'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary',
                      status === 'needs-size' && 'border-primary',
                    )}
                  >
                    <input
                      type="radio"
                      name="size"
                      value={s}
                      checked={size === s}
                      onChange={() => {
                        edit(setSize)(s);
                        setQuantity((q) => Math.min(q, Math.max(1, Math.min(MAX_LINE_QUANTITY, stock)))); // never above this size's stock
                      }}
                      disabled={stock === 0}
                      aria-label={stock === 0 ? `${s === 'OS' ? 'One size' : s} (sold out)` : undefined}
                      className="sr-only"
                    />
                    {s === 'OS' ? 'One size' : s}
                  </label>
                ))}
              </div>
              {status === 'needs-size' && (
                <p id="size-error" role="alert" className="mt-2 text-micro font-medium text-primary">
                  Please choose a size to continue.
                </p>
              )}
            </fieldset>

            {/* Personalisation */}
            {product.customizable && (
              <div className="mt-6 border border-line">
                <label className="flex cursor-pointer items-start gap-3 p-4">
                  <input
                    type="checkbox"
                    checked={personalise}
                    onChange={(e) => {
                      setPersonalise(e.target.checked);
                      setStatus('idle');
                      if (e.target.checked) setImageIndex(BACK_INDEX); // show the back so the print is visible
                    }}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold">
                      Personalise with name & number <span className="text-primary">+{formatPrice(product.printPrice)}</span>
                    </span>
                    <span className="block text-micro text-muted">See it live on the back of the shirt.</span>
                  </span>
                </label>
                {personalise && (
                  <div ref={printRef} className="border-t border-line p-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
                      <div>
                        <label htmlFor={nameId} className="eyebrow block text-ink/60">Name</label>
                        <input
                          id={nameId}
                          value={printName}
                          onChange={(e) => {
                            setPrintName(sanitizeName(e.target.value));
                            setImageIndex(BACK_INDEX);
                            setStatus('idle');
                          }}
                          maxLength={NAME_MAX}
                          placeholder="Up to 12 letters"
                          autoComplete="off"
                          className="mt-1.5 h-11 w-full rounded-btn border border-line bg-white px-3.5 text-sm font-semibold uppercase tracking-wide outline-none transition-colors placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink/35 focus:border-ink focus:ring-1 focus:ring-ink"
                        />
                      </div>
                      <div>
                        <label htmlFor={numberId} className="eyebrow block text-ink/60">Number</label>
                        <input
                          id={numberId}
                          value={printNumber}
                          onChange={(e) => {
                            setPrintNumber(sanitizeNumber(e.target.value));
                            setImageIndex(BACK_INDEX);
                            setStatus('idle');
                          }}
                          maxLength={NUMBER_MAX}
                          inputMode="numeric"
                          placeholder="0–99"
                          autoComplete="off"
                          className="mt-1.5 h-11 w-full rounded-btn border border-line bg-white px-3.5 text-sm font-semibold tracking-wide outline-none transition-colors placeholder:font-normal placeholder:tracking-normal placeholder:text-ink/35 focus:border-ink focus:ring-1 focus:ring-ink"
                        />
                      </div>
                    </div>
                    {status === 'needs-print' && (
                      <p role="alert" className="mt-2 text-micro font-medium text-primary">
                        Enter a name, a number, or both — or switch personalisation off.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Quantity + buttons */}
            <div className="mt-7">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div>
                  <p className="eyebrow mb-2 text-ink/60">Quantity</p>
                  <QuantityStepper value={Math.min(quantity, maxQuantity)} onChange={edit(setQuantity)} max={maxQuantity} label="Quantity" />
                </div>
                <p className="text-sm text-ink/70 sm:ml-auto sm:text-right">
                  Total <strong className="block text-xl font-bold tabular-nums text-ink">{formatPriceExact(total)}</strong>
                </p>
              </div>

              <div ref={ctaRef}>
              <div className="mt-4 flex gap-3">
                <Button onClick={() => addToCart()} disabled={soldOut} arrow={status !== 'added'} fullWidth className="h-12 flex-1">
                  {soldOut ? 'Sold out' : status === 'added' ? (<><Check aria-hidden className="size-4" /> Added to cart</>) : 'Add to cart'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setWishlisted((w) => !w)}
                  aria-pressed={wishlisted}
                  aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                  className="h-12 shrink-0 px-4"
                >
                  <Heart aria-hidden className={cn('size-4', wishlisted && 'fill-primary text-primary')} />
                  <span className="hidden sm:inline">{wishlisted ? 'Saved' : 'Save'}</span>
                </Button>
              </div>
              <Button variant="secondary" onClick={buyNow} disabled={soldOut} fullWidth className="mt-3 h-12">
                Buy it now
              </Button>
              </div>

              <AnimatePresence>
                {status === 'added' && (
                  <motion.div
                    role="status"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-gold/40 bg-gold/10 p-4 text-sm"
                  >
                    <p className="flex items-center gap-2 font-medium">
                      <CheckCircle2 aria-hidden className="size-5 text-gold" />
                      {quantity} × {product.name}
                      {size && `, size ${size}`} added to your cart.
                    </p>
                    <span className="flex gap-5">
                      <Link href="/checkout" className="eyebrow text-ink underline underline-offset-4 hover:text-primary">
                        Checkout →
                      </Link>
                      <Link href="/#new-season" className="eyebrow text-ink/60 hover:text-primary">
                        Keep shopping
                      </Link>
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <ul className="mt-7 grid gap-3 border-y border-line py-5 sm:grid-cols-3">
              {trust.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5 text-micro text-ink/75">
                  <Icon aria-hidden className="size-5 shrink-0 text-gold" />
                  {text}
                </li>
              ))}
            </ul>

            <dl className="mt-5 grid grid-cols-[5rem_1fr] gap-y-1.5 text-micro">
              <dt className="text-muted">SKU</dt>
              <dd className="font-medium">{product.sku}</dd>
              <dt className="text-muted">Category</dt>
              <dd className="font-medium">{product.categoryName}</dd>
              <dt className="text-muted">Tags</dt>
              <dd className="font-medium">{product.tags.join(', ')}</dd>
            </dl>

            <ProductAccordion product={product} />
          </div>
        </div>
      </Container>

      {/* Mobile sticky buy bar */}
      <AnimatePresence>
        {showStickyBar && !soldOut && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden"
          >
            <div className="min-w-0 flex-1">
              <p className="eyebrow truncate">{product.name}</p>
              <p className="text-sm font-bold tabular-nums">{formatPriceExact(total)}</p>
            </div>
            <Button onClick={() => addToCart()} className="h-11 shrink-0">
              {status === 'added' ? 'Added ✓' : size ? 'Add to cart' : 'Choose size'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
