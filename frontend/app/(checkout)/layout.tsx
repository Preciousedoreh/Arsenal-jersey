import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { CheckoutHeader } from '@/components/checkout/CheckoutHeader';

/** Checkout chrome: dark announcement bar and a slim header, no navigation or footer to distract. */
export default function CheckoutLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-surface">
      <AnnouncementBar tone="dark" />
      <CheckoutHeader />
      <main id="main">{children}</main>
    </div>
  );
}
