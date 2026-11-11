'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Heart, Menu, Search, ShoppingBag, User } from 'lucide-react';
import { Logo } from '@/components/ui/Brand';
import { MobileMenu } from './MobileMenu';
import { selectCartCount, useCart } from '@/lib/cart-store';
import { useHasMounted } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import type { NavLink } from '@/types';

const iconButton =
  'relative grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-surface hover:text-primary';

/** "Kits ▾" dropdown: opens on hover or click, closes on Escape / outside click. */
function NavDropdown({ item }: { item: NavLink }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <li ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="kits-menu"
        onClick={() => setOpen((o) => !o)}
        className="eyebrow flex items-center gap-1 py-2 text-ink/80 transition-colors hover:text-primary"
      >
        {item.label}
        <ChevronDown aria-hidden className={cn('size-3 transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            id="kits-menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 top-full z-50 min-w-44 -translate-x-1/2 border border-line bg-white py-2 shadow-xl"
          >
            {item.children?.map((child) => (
              <li key={child.label}>
                <Link
                  href={child.href}
                  onClick={() => setOpen(false)}
                  className="eyebrow block px-5 py-2.5 text-ink/80 transition-colors hover:bg-surface hover:text-primary"
                >
                  {child.label}
                </Link>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </li>
  );
}

/** Sticky white navbar with the cart badge wired to the cart store. */
export function Navbar({ nav }: { nav: NavLink[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const count = useCart(selectCartCount);
  const mounted = useHasMounted(); // cart lives in localStorage → only show the badge after hydration
  const shownCount = mounted ? count : 0;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-site items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <button type="button" className={cn(iconButton, 'lg:hidden')} onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}>
            <Menu aria-hidden className="size-5" />
          </button>
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
        </div>

        <ul className="hidden items-center gap-8 lg:flex">
          {nav.map((item) =>
            item.children ? (
              <NavDropdown key={item.label} item={item} />
            ) : (
              <li key={item.label}>
                <Link href={item.href} className="eyebrow py-2 text-ink/80 transition-colors hover:text-primary">
                  {item.label}
                </Link>
              </li>
            ),
          )}
        </ul>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <button type="button" className={iconButton} aria-label="Search">
            <Search aria-hidden className="size-[18px]" />
          </button>
          <button type="button" className={cn(iconButton, 'hidden sm:grid')} aria-label="Account">
            <User aria-hidden className="size-[18px]" />
          </button>
          <button type="button" className={cn(iconButton, 'hidden sm:grid')} aria-label="Wishlist">
            <Heart aria-hidden className="size-[18px]" />
          </button>
          <Link href="/checkout" className={iconButton} aria-label={`Cart, ${shownCount} ${shownCount === 1 ? 'item' : 'items'}. Go to checkout`}>
            <ShoppingBag aria-hidden className="size-[18px]" />
            <AnimatePresence>
              {shownCount > 0 && (
                <motion.span
                  key={shownCount}
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  aria-hidden
                  className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[18px] text-white"
                >
                  {shownCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        </div>
      </nav>

      <MobileMenu nav={nav} open={mobileOpen} onClose={closeMobile} />
    </header>
  );
}
