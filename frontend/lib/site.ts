import type { Category, NavLink } from '@/types';

/**
 * Brand settings in one place. The name is a neutral placeholder: replace it (and the logo/crest
 * placeholders in components/ui) with marks you have the rights to use.
 */
export const siteConfig = {
  name: 'REDLINE',
  tagline: 'Premium football kits for the red half of the city.',
  description: 'Home, away, third, retro and training kits. Wear the game.',
  announcement: ['NEW SEASON', 'FREE SHIPPING OVER $100', 'AUTHENTIC KITS ONLY'],
  currentYear: 2026,
} as const;

export const categoryHref = (slug: string) => `/category/${slug}`;

/** Only categories that currently have something to buy are linked from the navigation. */
const shoppable = (categories: Category[]) => categories.filter((c) => c.productCount > 0);

/** Top navigation. The "Kits" dropdown is built from the live categories. */
export function buildMainNav(categories: Category[]): NavLink[] {
  return [
    { label: 'Shop', href: '/shop' },
    {
      label: 'Kits',
      href: '/shop',
      children: shoppable(categories).map((c) => ({ label: c.name, href: categoryHref(c.slug) })),
    },
    { label: 'Collections', href: '/#categories' },
    { label: 'New Arrivals', href: '/#new-season' },
  ];
}

export function buildFooterNav(categories: Category[]): { title: string; links: NavLink[] }[] {
  return [
    {
      title: 'Shop',
      links: [
        { label: 'All kits', href: '/shop' },
        ...shoppable(categories)
          .slice(0, 4)
          .map((c) => ({ label: c.name, href: categoryHref(c.slug) })),
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'Shipping', href: '#' },
        { label: 'Returns', href: '#' },
        { label: 'Size Guide', href: '#' },
        { label: 'Contact', href: '#' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: '#' },
        { label: 'Stores', href: '#' },
        { label: 'Authenticity', href: '#' },
      ],
    },
  ];
}

/** Countdown schedules (local time). Drops recur, so the timers never run out in a demo. */
export const dropSchedule = {
  /** Daily matchday drop at 18:00. */
  matchday: { kind: 'daily', hour: 18 },
  /** Weekly limited edition drop, Fridays at 18:00. */
  limited: { kind: 'weekly', weekday: 5, hour: 18 },
} as const;
