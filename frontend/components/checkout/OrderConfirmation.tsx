import Image from 'next/image';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { describeItem, type Receipt } from '@/lib/checkout';
import { formatPriceExact } from '@/lib/utils';

/** Step 4: order placed. Shows what was bought from the receipt snapshot (the cart is already empty). */
export function OrderConfirmation({ receipt }: { receipt: Receipt }) {
  return (
    <section aria-labelledby="confirmation-title" className="mx-auto max-w-2xl border border-line border-t-[3px] border-t-primary bg-white p-6 sm:p-10">
      <div className="flex items-center gap-4">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-white">
          <Check className="size-6" strokeWidth={3} />
        </span>
        <div>
          <h2 id="confirmation-title" className="headline text-3xl sm:text-4xl">
            Order confirmed
          </h2>
          <p className="mt-1 text-sm text-ink/70">
            Thanks, {receipt.firstName}. A confirmation will be sent to <strong className="font-semibold text-ink">{receipt.email}</strong>.
          </p>
        </div>
      </div>

      <dl className="mt-8 grid gap-4 border-y border-line py-5 text-sm sm:grid-cols-2">
        <div>
          <dt className="eyebrow text-ink/60">Order number</dt>
          <dd className="mt-1 font-semibold tabular-nums">{receipt.reference}</dd>
        </div>
        <div>
          <dt className="eyebrow text-ink/60">Delivery</dt>
          <dd className="mt-1 font-semibold">
            {receipt.deliveryLabel} · {receipt.deliveryDetail}
            <span className="block text-micro font-normal text-muted">to {receipt.city}</span>
          </dd>
        </div>
      </dl>

      <ul className="mt-5 space-y-4">
        {receipt.items.map((item) => (
          <li key={item.key} className="flex items-center gap-3">
            <div className="relative size-14 shrink-0 bg-surface">
              <Image src={item.image} alt="" fill sizes="56px" className="object-contain p-1.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow truncate">{item.name}</p>
              <p className="mt-0.5 text-micro text-muted">
                {describeItem(item)} · Qty {item.quantity}
              </p>
            </div>
            <p className="text-sm font-bold">{formatPriceExact(item.price * item.quantity)}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink/70">Subtotal</dt>
          <dd className="font-semibold">{formatPriceExact(receipt.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink/70">Delivery</dt>
          <dd className="font-bold">{receipt.delivery === 0 ? 'FREE' : formatPriceExact(receipt.delivery)}</dd>
        </div>
        <div className="flex items-end justify-between border-t border-line pt-3">
          <dt className="eyebrow text-ink">Total paid</dt>
          <dd className="headline text-3xl">{formatPriceExact(receipt.total)}</dd>
        </div>
      </dl>

      <Button href="/" arrow className="mt-8">
        Continue shopping
      </Button>
    </section>
  );
}
