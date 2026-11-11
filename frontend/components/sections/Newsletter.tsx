'use client';

import Image from 'next/image';
import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/ui/Reveal';
import { images } from '@/data/images';
import { EMAIL_PATTERN, cn } from '@/lib/utils';

const FAKE_REQUEST_MS = 600;

/** Newsletter sign-up with inline validation and a success state (no backend: the request is simulated). */
export function Newsletter() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const inputId = useId();
  const errorId = useId();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return setError('Please enter your email address.');
    if (!EMAIL_PATTERN.test(value)) return setError('That email address doesn’t look right.');
    setError(null);
    setState('submitting');
    await new Promise((r) => setTimeout(r, FAKE_REQUEST_MS)); // replace with a real API call
    setState('done');
  };

  return (
    <section aria-labelledby="newsletter-title" className="overflow-hidden py-section">
      <Container className="grid items-center gap-12 md:grid-cols-2">
        <Reveal from="left">
          <h2 id="newsletter-title" className="headline text-[clamp(3rem,6vw,4.5rem)]">
            Never miss
            <br />a <span className="text-primary">drop.</span>
          </h2>
          <p className="mt-4 text-sm text-ink/60">Get notified when new kits arrive.</p>

          <AnimatePresence mode="wait">
            {state === 'done' ? (
              <motion.p
                key="done"
                role="status"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 flex max-w-md items-center gap-3 border border-gold/40 bg-gold/10 p-4 text-sm font-medium"
              >
                <CheckCircle2 aria-hidden className="size-5 shrink-0 text-gold" />
                You’re on the list. We’ll email {email.trim()} before the next drop.
              </motion.p>
            ) : (
              <motion.form key="form" exit={{ opacity: 0 }} onSubmit={onSubmit} noValidate className="mt-8 max-w-md">
                <label htmlFor={inputId} className="sr-only">
                  Email address
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id={inputId}
                    type="email"
                    autoComplete="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className={cn(
                      'h-11 w-full rounded-btn border bg-white px-4 text-sm sm:flex-1 outline-none transition-colors placeholder:text-ink/40 focus:border-primary',
                      error ? 'border-primary' : 'border-line',
                    )}
                  />
                  <Button type="submit" arrow disabled={state === 'submitting'}>
                    {state === 'submitting' ? 'Joining…' : 'Join the list'}
                  </Button>
                </div>
                {error && (
                  <p id={errorId} role="alert" className="mt-2 text-micro font-medium text-primary">
                    {error}
                  </p>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </Reveal>

        <Reveal from="right" className="relative aspect-[4/3] w-full">
          <div className="absolute inset-y-[8%] left-[18%] right-0 overflow-hidden">
            <Image src={images.scenes.newsletter} alt="" fill sizes="(min-width: 768px) 45vw, 90vw" className="object-cover" />
          </div>
          <div className="absolute inset-y-0 left-0 w-[62%] -rotate-6 transition-transform duration-500 hover:rotate-0">
            <Image src={images.kits.away} alt="Off-white away shirt" fill sizes="(min-width: 768px) 30vw, 60vw" className="object-contain drop-shadow-2xl" />
          </div>
          <Badge tone="red" className="absolute right-[6%] top-[14%]">
            New
          </Badge>
        </Reveal>
      </Container>
    </section>
  );
}
