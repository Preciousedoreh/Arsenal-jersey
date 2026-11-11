'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/ui/Reveal';
import { images } from '@/data/images';
import { NAME_MAX, NUMBER_MAX, sanitizeName, sanitizeNumber } from '@/lib/personalisation';
import { cn, formatPrice } from '@/lib/utils';
import type { Product } from '@/types';

/** The three shirt-back previews. `text` is the print colour that reads best on each. */
const previews = [
  { id: 'red', label: 'Red home', image: images.kitBacks.red, text: 'text-white', bg: 'bg-surface' },
  { id: 'white', label: 'White away', image: images.kitBacks.white, text: 'text-primary', bg: 'bg-surface' },
  { id: 'black', label: 'Black & gold', image: images.kitBacks.black, text: 'text-gold-light', bg: 'bg-ink' },
] as const;

export type CustomizerTargets = Partial<Record<(typeof previews)[number]['id'], Product>>;

/**
 * "Make it yours": live name & number preview over the back of the shirt. Each preview belongs to a
 * real product; "Customize kit" opens that product's page with the print filled in, where the
 * customer picks a size and adds it to the cart.
 */
export function Customizer({ targets }: { targets: CustomizerTargets }) {
  const router = useRouter();
  const options = previews.filter((p) => targets[p.id]);
  const [name, setName] = useState('');
  const [number, setNumber] = useState('');
  const [optionIndex, setOptionIndex] = useState(0);
  const nameId = useId();
  const numberId = useId();

  const option = options[optionIndex] ?? options[0];
  if (!option) return null;
  const target = targets[option.id]!;

  const previewName = name.trim() || 'YOUR NAME';
  const previewNumber = number || '10';

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = new URLSearchParams();
    if (name.trim()) query.set('name', name.trim());
    if (number) query.set('number', number);
    router.push(`/products/${target.slug}${query.size > 0 ? `?${query}` : ''}`);
  };

  const input =
    'mt-2 h-11 w-full rounded-btn border border-line bg-white px-3 text-sm font-semibold uppercase tracking-wide outline-none transition-colors placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-ink/35 focus:border-primary';

  return (
    <section id="customize" aria-labelledby="customize-title" className="bg-surface py-section">
      <Container>
        <div className="grid items-center gap-10 bg-white p-6 shadow-sm sm:p-10 md:grid-cols-[1fr_1.1fr] lg:p-14">
          <Reveal from="left">
            <h2 id="customize-title" className="headline text-4xl md:text-5xl">
              Make it <span className="text-primary">yours</span>
            </h2>
            <p className="mt-3 text-sm text-ink/60">Customise your jersey with name and number.</p>

            <form onSubmit={onSubmit} className="mt-8 max-w-sm space-y-5" noValidate>
              <div>
                <label htmlFor={nameId} className="eyebrow text-ink/60">
                  Name
                </label>
                <input id={nameId} value={name} onChange={(e) => setName(sanitizeName(e.target.value))} maxLength={NAME_MAX} placeholder="Up to 12 letters" autoComplete="off" className={input} />
              </div>
              <div>
                <label htmlFor={numberId} className="eyebrow text-ink/60">
                  Number
                </label>
                <input
                  id={numberId}
                  value={number}
                  onChange={(e) => setNumber(sanitizeNumber(e.target.value))}
                  maxLength={NUMBER_MAX}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0–99"
                  autoComplete="off"
                  className={input}
                />
              </div>
              <Button type="submit" arrow>
                Customize kit
              </Button>
              <p className="text-micro text-ink/50">
                +{formatPrice(target.printPrice)} for official name & number printing. You’ll choose your size on the next page.
              </p>
            </form>
          </Reveal>

          <div className="flex items-center gap-4">
            {/* Preview: same aspect ratio as the shirt art, so the print lines up at every size. */}
            <div className={cn('@container relative aspect-[10/11] flex-1 overflow-hidden transition-colors', option.bg)}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={option.id} className="absolute inset-0" initial={{ opacity: 0, rotateY: -12 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
                  <Image src={option.image} alt={`Back of the ${option.label} shirt`} fill sizes="(min-width: 768px) 40vw, 80vw" className="object-contain" />
                </motion.div>
              </AnimatePresence>
              <div aria-live="polite" className={cn('pointer-events-none absolute inset-x-0 top-[21%] flex flex-col items-center text-center', option.text)}>
                <span className="font-display text-[7.5cqw] uppercase leading-none tracking-[0.12em]">{previewName}</span>
                <span className="mt-[2cqw] font-display text-[34cqw] leading-[0.85]">{previewNumber}</span>
              </div>
            </div>

            <div role="radiogroup" aria-label="Shirt colour" className="flex flex-col gap-3">
              {options.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={p.id === option.id}
                  aria-label={p.label}
                  onClick={() => setOptionIndex(i)}
                  className={cn(
                    'relative size-14 overflow-hidden border-2 transition-colors sm:size-16',
                    p.bg,
                    p.id === option.id ? 'border-primary' : 'border-transparent hover:border-ink/20',
                  )}
                >
                  <Image src={p.image} alt="" fill sizes="64px" className="object-contain p-1" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
