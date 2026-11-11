'use client';

import Image from 'next/image';
import { ArrowRight, LoaderCircle, RotateCcw, ShieldCheck, Truck, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { describeItem, getSubtotal, getUnitCount } from '@/lib/checkout';
import { cn, formatPriceExact } from '@/lib/utils';
import type { CartItem } from '@/types';

interface OrderSummaryProps {
  items: CartItem[];
  /** True until the cart has been read from localStorage. */
  loading: boolean;
  delivery: number;
  processing: boolean;
  /** Show the "check the highlighted fields" message. */
  showFormError: boolean;
  onQuantityChange: (key: string, quantity: number) => void;
  onRemove: (key: string) => void;
  className?: string;
}

const trust = [
  { Icon: ShieldCheck, text: 'Authentic, officially licensed merchandise' },
  { Icon: Truck, text: 'Fast worldwide delivery' },
  { Icon: RotateCcw, text: '30-day returns on unworn kits' },
] as const;

/** "Your order" card: editable lines, totals, the place-order button and trust notes. */
export function OrderSummary({
  items,
  loading,
  delivery,
  processing,
  showFormError,
  onQuantityChange,
  onRemove,
  className,
}: OrderSummaryProps) {
  const subtotal = getSubtotal(items);
  const total = subtotal + delivery;
  const units = getUnitCount(items);

  return (
    <aside aria-labelledby="order-summary-title" className={cn('border border-line border-t-[3px] border-t-primary bg-white p-6', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="order-summary-title" className="headline text-2xl">
          Your order
        </h2>
        {!loading && (
          <p className="text-micro text-muted">
            {units} {units === 1 ? 'item' : 'items'}
          </p>
        )}
      </div>

      {loading ? (
        <div aria-hidden className="mt-5 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="size-[60px] animate-pulse bg-surface" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 animate-pulse bg-surface" />
                <div className="h-3 w-32 animate-pulse bg-surface" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <ul className="mt-5 space-y-4">
          {items.map((item) => (
            <li key={item.key} className="flex gap-3">
              <div className="relative size-[60px] shrink-0 bg-surface">
                <Image src={item.image} alt="" fill sizes="60px" className="object-contain p-1.5" />
                <span aria-hidden className="absolute -left-1.5 -top-1.5 grid size-[18px] place-items-center rounded-full bg-ink text-tiny font-bold text-white">
                  {item.quantity}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="eyebrow truncate text-ink">{item.name}</p>
                    <p className="mt-0.5 text-micro text-muted">{describeItem(item)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(item.key)}
                    aria-label={`Remove ${item.name} from your order`}
                    className="-mr-1 -mt-1 grid size-6 shrink-0 place-items-center text-ink/40 transition-colors hover:text-primary"
                  >
                    <X aria-hidden className="size-3.5" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <QuantityStepper
                    size="sm"
                    label={`Quantity of ${item.name}`}
                    value={item.quantity}
                    onChange={(quantity) => onQuantityChange(item.key, quantity)}
                  />
                  <p className="text-sm font-bold">{formatPriceExact(item.price * item.quantity)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink/70">Subtotal</dt>
          <dd className="font-semibold">{formatPriceExact(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink/70">Delivery</dt>
          <dd className="font-bold">{delivery === 0 ? 'FREE' : formatPriceExact(delivery)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
        <span className="eyebrow text-ink">Total</span>
        <span className="headline text-4xl">{formatPriceExact(total)}</span>
      </div>
      <p className="mt-2 text-micro text-muted">Duties and taxes included in all prices.</p>

      {showFormError && (
        <p role="alert" className="mt-4 text-micro font-medium text-primary">
          Please check the highlighted fields.
        </p>
      )}
      <Button type="submit" fullWidth className="mt-5 h-12" disabled={loading || items.length === 0 || processing}>
        {processing ? (
          <>
            <LoaderCircle aria-hidden className="size-4 animate-spin" /> Processing…
          </>
        ) : (
          <>
            Place order · {formatPriceExact(total)}
            <ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </>
        )}
      </Button>

      <ul className="mt-5 space-y-2.5">
        {trust.map(({ Icon, text }) => (
          <li key={text} className="flex items-center gap-2.5 text-micro text-ink/70">
            <Icon aria-hidden className="size-4 shrink-0 text-gold" />
            {text}
          </li>
        ))}
      </ul>
    </aside>
  );
}
