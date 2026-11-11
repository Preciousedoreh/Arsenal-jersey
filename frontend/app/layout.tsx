import type { Metadata, Viewport } from 'next';
import { Anton, Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import { siteConfig } from '@/lib/site';
import './globals.css';

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: `${siteConfig.name} — Football Kits & Apparel`,
  description: siteConfig.description,
};

export const viewport: Viewport = {
  themeColor: '#ef0107',
};

/**
 * Root shell only: fonts, providers and the skip link. The page chrome lives in the route-group
 * layouts: `(shop)` = announcement bar + navbar + footer, `(checkout)` = slim secure header.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-scroll-behavior: tells Next we use `scroll-behavior: smooth` (globals.css), so route changes still jump to the top instantly.
    <html lang="en" data-scroll-behavior="smooth" className={`${anton.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-white font-sans text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
