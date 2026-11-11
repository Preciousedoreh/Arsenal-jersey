import { cn } from '@/lib/utils';
import { siteConfig } from '@/lib/site';

/**
 * PLACEHOLDER CREST — a generic shield. Replace the SVG with a crest you have the rights to use
 * (or swap this component for <Image src="/images/crest.svg" ... />).
 */
export function CrestPlaceholder({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 33" aria-hidden className={cn('shrink-0', className)}>
      <path d="M0 0H26V13Q26 26 13 33Q0 26 0 13Z" fill="currentColor" />
      <path d="M13 8l2 4.2 4.6.6-3.3 3.2.8 4.6L13 18.4l-4.1 2.2.8-4.6-3.3-3.2 4.6-.6Z" className="fill-gold-light" />
    </svg>
  );
}

/** PLACEHOLDER LOGO — crest + wordmark from siteConfig.name. */
export function Logo({ tone = 'dark', className }: { tone?: 'dark' | 'light'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <CrestPlaceholder className="h-7 w-auto text-primary" />
      <span className={cn('headline text-xl tracking-wide', tone === 'light' ? 'text-white' : 'text-ink')}>{siteConfig.name}</span>
    </span>
  );
}
