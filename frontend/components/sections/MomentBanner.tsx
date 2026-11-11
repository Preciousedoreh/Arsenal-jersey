import Image from 'next/image';
import { Container } from '@/components/ui/Container';
import { Reveal } from '@/components/ui/Reveal';
import { images } from '@/data/images';

/** Cinematic full-width photo, headline bottom-left. */
export function MomentBanner() {
  return (
    <section aria-labelledby="moment-title" className="relative isolate overflow-hidden bg-ink text-white">
      <Image src={images.scenes.moment} alt="Player in the red home shirt under stadium floodlights" fill sizes="100vw" className="-z-10 object-cover object-[65%_center]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-tr from-ink/90 via-ink/30 to-transparent" />
      <Container className="flex min-h-[420px] items-end py-12 md:min-h-[560px] md:py-16">
        <Reveal>
          <h2 id="moment-title" className="headline text-[clamp(3rem,7vw,5.5rem)]">
            Built for
            <br />
            the <span className="text-primary">moment.</span>
          </h2>
        </Reveal>
      </Container>
    </section>
  );
}
