'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Logo } from '@/components/ui/Brand';
import type { NavLink } from '@/types';

interface MobileMenuProps {
  nav: NavLink[];
  open: boolean;
  onClose: () => void;
}

/** Slide-in drawer for small screens: Escape / backdrop close it, focus moves in and the page stops scrolling. */
export function MobileMenu({ nav, open, onClose }: MobileMenuProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <motion.div className="absolute inset-0 bg-ink/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col bg-white"
          >
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo />
              <button ref={closeRef} type="button" onClick={onClose} aria-label="Close menu" className="grid size-9 place-items-center rounded-full hover:bg-surface">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-4 py-6">
              <ul className="space-y-1">
                {nav.map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} onClick={onClose} className="headline block py-2 text-3xl transition-colors hover:text-primary">
                      {item.label}
                    </Link>
                    {item.children && (
                      <ul className="mb-2 ml-1 grid grid-cols-2 gap-x-4 border-l-2 border-primary pl-4">
                        {item.children.map((child) => (
                          <li key={child.label}>
                            <Link href={child.href} onClick={onClose} className="eyebrow block py-2 text-ink/70 hover:text-primary">
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
            <p className="border-t border-line px-4 py-4 text-micro text-muted">Free shipping over $100 · Authentic kits only</p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
