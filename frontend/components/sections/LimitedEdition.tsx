import Image from 'next/image';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Countdown } from '@/components/ui/Countdown';
import { Reveal } from '@/components/ui/Reveal';
import type { Product } from '@/types';
import { dropSchedule } from '@/lib/site';
import { formatPrice } from '@/lib/utils';

/** Black-and-gold limited drop with a days/hours/minutes/seconds countdown. */
export function LimitedEdition({ product: limitedProduct }: { product: Product }) {
  return (
    <section aria-labelledby="limited-title" className="relative isolate overflow-hidden bg-ink text-white">
      {/* Gold spotlight + fine pinstripes */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_45%,rgba(214,182,110,0.28),transparent_55%)]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[repeating-linear-gradient(90deg,transparent_0_38px,rgba(156,130,74,0.08)_38px_39px)]" />

      <Container className="grid items-center gap-10 py-section md:grid-cols-2">
        <Reveal from="left">
          <Badge tone="red">Limited stock</Badge>
          <h2 id="limited-title" className="headline mt-5 text-[clamp(3.5rem,8vw,6.5rem)]">
            Limited
            <br />
            <span className="bg-gradient-to-r from-gold-light via-gold to-gold-light bg-clip-text text-transparent">edition</span>
          </h2>
          <p className="mt-4 eyebrow text-white/70">Only the few get the drop.</p>
          <Countdown
            schedule={dropSchedule.limited}
            units={['days', 'hours', 'minutes', 'seconds']}
            label="Time until the limited edition drop"
            className="mt-8"
            digitClassName="text-4xl md:text-5xl"
          />
          <div className="mt-8 flex items-center gap-5">
            <Button href={`/products/${limitedProduct.slug}`} variant="gold" arrow>
              Get the drop
            </Button>
            <span className="text-sm font-semibold text-gold-light">{formatPrice(limitedProduct.price)}</span>
          </div>
        </Reveal>

        <Reveal from="right" className="relative mx-auto aspect-[10/11] w-full max-w-md">
          <Image id={limitedProduct.slug} src={limitedProduct.images[0]!} alt="Black shirt with gold pinstripes and gold trim" fill sizes="(min-width: 768px) 40vw, 80vw" className="object-contain drop-shadow-[0_30px_60px_rgba(214,182,110,0.25)]" />
        </Reveal>
      </Container>
    </section>
  );
}
