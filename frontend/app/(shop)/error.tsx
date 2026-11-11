'use client';

import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';

/** Shown when a storefront page can't load its data (typically: the API isn't reachable). */
export default function ShopError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="py-24 text-center">
      <h1 className="headline text-5xl">We couldn’t load the shop</h1>
      <p className="mx-auto mt-4 max-w-md text-sm text-ink/70">Something went wrong on our side. Please try again in a moment.</p>
      <Button onClick={reset} arrow className="mt-8">
        Try again
      </Button>
    </Container>
  );
}
