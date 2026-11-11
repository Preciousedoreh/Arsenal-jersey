import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin — REDLINE',
  // The admin area must never appear in search results.
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="min-h-screen bg-surface text-ink">{children}</div>;
}
