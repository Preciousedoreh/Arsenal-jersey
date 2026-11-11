'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Heart, ShoppingBag } from 'lucide-react';
import { Badge } from './Badge';
import { StarRating } from './StarRating';
import { DEFAULT_SIZE, useCart } from '@/lib/cart-store';
import { cn, formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

const ADDED_FEEDBACK_MS = 1500;

interface ProductCardProps {
  product: Product;
  /** `feature`: large New Season card. `compact`: Best Sellers card with wishlist, rating and cart. */
  variant?: 'feature' | 'compact';
  /** Pass for above-the-fold cards. */
  priority?: boolean;
}

/** Product tile: light grey image well, centred kit, uppercase name, price. Lifts on hover. */
export function ProductCard({ product, variant = 'feature', priority = false }: ProductCardProps) {
  const add = useCart((s) => s.add);
  const [wishlisted, setWishlisted] = useState(false);
  const [added, setAdded] = useState(false);
  const compact = variant === 'compact';
  const soldOut = product.stock <= 0;
  // Quick-add uses size M when it's in stock, otherwise the first size that is.
  const quickSize = (product.sizes.find((s) => s.size === DEFAULT_SIZE && s.stock > 0) ?? product.sizes.find((s) => s.stock > 0))?.size;

  const addToCart = () => {
    if (!quickSize) return;
    add({ productId: product.id, name: product.name, price: product.price, image: product.images[0]!, size: quickSize });
    setAdded(true);
    setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
  };

  return (
    <motion.article
      id={product.slug}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25 }}
      className="group relative flex flex-col"
    >
      <div className={cn('relative overflow-hidden bg-surface', compact ? 'aspect-square' : 'aspect-[4/5]')}>
        {/* Clicking the shirt opens its product page, where size and options are chosen. */}
        <Link
          href={`/products/${product.slug}`}
          aria-label={`${product.name}, ${formatPrice(product.price)} — view details`}
          className="absolute inset-0 z-10"
        />
        <Image
          src={product.images[0]!}
          alt={`${product.name} shirt`}
          fill
          priority={priority}
          sizes={compact ? '(min-width: 1024px) 25vw, 50vw' : '(min-width: 768px) 33vw, 100vw'}
          className="object-contain p-[12%] transition-transform duration-500 ease-out-expo group-hover:scale-105"
        />
        {soldOut && (
          <Badge tone="dark" className="absolute left-3 top-3 z-20">
            Sold out
          </Badge>
        )}
        {product.badge && !compact && !soldOut && (
          <Badge tone={product.badge === 'LIMITED' ? 'gold' : 'red'} className="absolute bottom-4 right-4">
            {product.badge}
          </Badge>
        )}
        {compact && (
          <button
            type="button"
            onClick={() => setWishlisted((w) => !w)}
            aria-pressed={wishlisted}
            aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            className="absolute right-2.5 top-2.5 z-20 grid size-8 place-items-center rounded-full bg-white/90 text-ink shadow-sm transition-colors hover:text-primary"
          >
            <Heart aria-hidden className={cn('size-4', wishlisted && 'fill-primary text-primary')} />
          </button>
        )}
      </div>

      {compact ? (
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="eyebrow truncate">{product.name}</h3>
            <p className="mt-1 text-sm font-semibold">{formatPrice(product.price)}</p>
            {product.reviewCount > 0 && <StarRating rating={product.rating} label={String(product.reviewCount)} className="mt-1.5" />}
          </div>
          <button
            type="button"
            onClick={addToCart}
            disabled={!quickSize}
            aria-label={quickSize ? `Add ${product.name} (size ${quickSize === 'OS' ? 'one size' : quickSize}) to cart` : `${product.name} is sold out`}
            className="grid size-9 shrink-0 place-items-center rounded-btn bg-primary text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-ink/20 disabled:hover:bg-ink/20"
          >
            {added ? <Check aria-hidden className="size-4" /> : <ShoppingBag aria-hidden className="size-4" />}
          </button>
        </div>
      ) : (
        <div className="mt-4 text-center">
          <h3 className="eyebrow">{product.name}</h3>
          <p className="mt-1 text-sm font-semibold">{formatPrice(product.price)}</p>
        </div>
      )}
    </motion.article>
  );
}
