import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getCategories } from '@/lib/catalog';
import { buildFooterNav, buildMainNav } from '@/lib/site';
import type { Category } from '@/types';

/** Storefront pages show live data, so they are rendered per request (the API responses are cached for 30s). */
export const dynamic = 'force-dynamic';

/** Storefront chrome: announcement bar, sticky navbar, footer. Navigation is built from the live categories. */
export default async function ShopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // If the API is down the pages themselves show an error; the chrome should still render.
  const categories: Category[] = await getCategories().catch(() => []);
  return (
    <>
      <AnnouncementBar />
      <Navbar nav={buildMainNav(categories)} />
      <main id="main">{children}</main>
      <Footer nav={buildFooterNav(categories)} />
    </>
  );
}
