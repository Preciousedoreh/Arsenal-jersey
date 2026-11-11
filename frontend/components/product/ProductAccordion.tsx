import { ChevronDown } from 'lucide-react';
import { deliveryOptions, FREE_DELIVERY_THRESHOLD } from '@/lib/checkout';
import { formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

/** One expandable row. Uses native <details>, so it is keyboard- and screen-reader-friendly for free. */
function Item({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="group border-b border-line">
      <summary className="eyebrow flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-ink [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown aria-hidden className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="pb-5 text-sm leading-relaxed text-ink/75">{children}</div>
    </details>
  );
}

/** "Details & care" and "Delivery & returns". */
export function ProductAccordion({ product }: { product: Product }) {
  return (
    <div className="mt-6 border-t border-line">
      <Item title="Details & care" defaultOpen>
        <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2.5">
          {product.specs.map((spec) => (
            <div key={spec.label} className="contents">
              <dt className="font-semibold text-ink">{spec.label}</dt>
              <dd>{spec.value}</dd>
            </div>
          ))}
        </dl>
      </Item>
      <Item title="Delivery & returns">
        <ul className="space-y-2">
          {deliveryOptions.map((option) => (
            <li key={option.id} className="flex justify-between gap-4">
              <span>
                <strong className="font-semibold text-ink">{option.label}</strong> · {option.detail}
              </span>
              <span className="font-semibold text-ink">
                {option.freeFrom !== undefined ? `Free over ${formatPrice(FREE_DELIVERY_THRESHOLD)}` : formatPrice(option.price)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4">Not right? Return unworn kits with tags within 30 days for a full refund. Duties and taxes are included in all prices.</p>
      </Item>
    </div>
  );
}
