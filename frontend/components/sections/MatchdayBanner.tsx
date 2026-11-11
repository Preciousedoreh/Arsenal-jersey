import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Container } from '@/components/ui/Container';
import { Countdown } from '@/components/ui/Countdown';
import { Reveal } from '@/components/ui/Reveal';
import { images } from '@/data/images';
import { dropSchedule } from '@/lib/site';

/** Full-width dark stadium banner with a live "next drop" countdown. */
export function MatchdayBanner() {
  return (
    <section aria-labelledby="matchday-title" className="relative isolate overflow-hidden bg-ink text-white">
      <Image src={images.scenes.matchday} alt="Player from behind wearing a red shirt with name and number" fill sizes="100vw" className="-z-10 object-cover object-[70%_center]" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/75 to-transparent" />
      <Container className="flex min-h-[460px] flex-col justify-between gap-10 py-12 md:min-h-[520px] md:py-14">
        <div>
          <Badge tone="outline-light">Next drop</Badge>
          <Countdown schedule={dropSchedule.matchday} label="Time until the next matchday drop" className="mt-3" digitClassName="text-4xl md:text-5xl" />
        </div>
        <Reveal from="left">
          <h2 id="matchday-title" className="headline text-[clamp(3.5rem,8vw,6.5rem)]">
            Matchday
            <br />
            <span className="text-primary">ready.</span>
          </h2>
          <Button href="#best-sellers" variant="gold" arrow className="mt-6">
            Get matchday kit
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
