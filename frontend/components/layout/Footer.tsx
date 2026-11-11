import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Logo } from '@/components/ui/Brand';
import { FacebookIcon, InstagramIcon, PaymentBadge, XIcon, YouTubeIcon } from '@/components/ui/Icons';
import { Container } from '@/components/ui/Container';
import { siteConfig } from '@/lib/site';
import type { NavLink } from '@/types';

const socials = [
  { label: 'Instagram', href: '#', Icon: InstagramIcon },
  { label: 'X', href: '#', Icon: XIcon },
  { label: 'Facebook', href: '#', Icon: FacebookIcon },
  { label: 'YouTube', href: '#', Icon: YouTubeIcon },
];

const payments = ['visa', 'paypal', 'mastercard', 'applepay'] as const;

/** Dark footer: brand + socials, link columns, payments and copyright. */
export function Footer({ nav }: { nav: { title: string; links: NavLink[] }[] }) {
  return (
    <footer className="bg-ink text-white">
      <div aria-hidden className="h-1 bg-gradient-to-r from-primary via-gold to-primary" />
      <Container className="py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo tone="light" />
            <p className="mt-4 max-w-xs text-sm text-white/60">{siteConfig.tagline}</p>
            <ul className="mt-6 flex gap-2">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a href={href} aria-label={label} className="grid size-9 place-items-center rounded-full border border-white/15 text-white/80 transition-colors hover:border-gold hover:text-gold-light">
                    <Icon className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {nav.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="eyebrow text-gold-light">{column.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/65 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-6 border-t border-white/10 pt-8 md:flex-row md:items-center md:justify-between">
          <ul className="flex flex-wrap items-center gap-2" aria-label="Accepted payment methods">
            {payments.map((method) => (
              <li key={method}>
                <PaymentBadge method={method} />
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 text-micro text-white/60">
            <Lock aria-hidden className="size-3.5 text-gold-light" />
            Secure Payment
          </p>
        </div>
        <p className="mt-6 text-micro text-white/45">
          © {siteConfig.currentYear} {siteConfig.name}. All rights reserved.
        </p>
      </Container>
    </footer>
  );
}
