import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge must know our custom theme tokens (globals.css @theme); otherwise it reads
 * `text-micro` as a colour and drops `text-white` (or vice versa) when both are present.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['micro', 'tiny'],
      tracking: ['label', 'wide-label'],
      radius: ['btn'],
      container: ['site'],
      leading: ['display'],
    },
  },
});

/** Merge Tailwind classes, letting later classes win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const usdWhole = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdExact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** "$89" for whole-dollar prices, "$79.50" when there are cents (never rounds a price). */
export function formatPrice(amount: number): string {
  return Number.isInteger(amount) ? usdWhole.format(amount) : usdExact.format(amount);
}

/** With cents ("$89.00") — used where exact totals matter, e.g. checkout. */
export function formatPriceExact(amount: number): string {
  return usdExact.format(amount);
}

/** Two-digit zero padding for countdown units. */
export function pad2(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

/** Simple, permissive email check (the server is the real authority). */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
