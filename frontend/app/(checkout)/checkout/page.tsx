import type { Metadata } from 'next';
import { CheckoutExperience } from '@/components/checkout/CheckoutExperience';
import { siteConfig } from '@/lib/site';

export const metadata: Metadata = {
  title: `Checkout — ${siteConfig.name}`,
  // Checkout pages should never show up in search results.
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return <CheckoutExperience />;
}
