import Link from 'next/link';
import { ChevronLeft, Lock } from 'lucide-react';
import { Logo } from '@/components/ui/Brand';

/** Slim white header: logo on the left, "Back to cart" and a secure-checkout note on the right. */
export function CheckoutHeader() {
  return (
    <header className="border-b border-line bg-white">
      <div className="mx-auto flex h-16 max-w-site items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Home">
          <Logo />
        </Link>
        <div className="flex items-center gap-5 sm:gap-7">
          {/* There is no separate cart page yet — the order summary is editable — so this returns to the shop. */}
          <Link href="/" className="eyebrow group flex items-center gap-1 text-ink transition-colors hover:text-primary">
            <ChevronLeft aria-hidden className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to cart
          </Link>
          <p className="eyebrow flex items-center gap-1.5 text-ink/60">
            <Lock aria-hidden className="size-3.5" />
            <span className="hidden sm:inline">Secure checkout</span>
            <span className="sr-only sm:hidden">Secure checkout</span>
          </p>
        </div>
      </div>
    </header>
  );
}
