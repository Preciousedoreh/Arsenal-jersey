'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { CartItem, Size } from '@/types';

/** Size used when a shirt is added from a card, where there is no size picker. */
export const DEFAULT_SIZE: Size = 'M';

/** Most units of a single cart line (same product, size, colour and print). */
export const MAX_LINE_QUANTITY = 10;

type NewItem = Omit<CartItem, 'key' | 'quantity'> & { quantity?: number };

interface CartState {
  items: CartItem[];
  add: (item: NewItem) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const clampQuantity = (n: number): number => Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.floor(n)));

/** Same product + size + colour + print → same cart line (quantities merge). */
function lineKey(item: NewItem): string {
  const print = item.customization ? `${item.customization.name}#${item.customization.number}` : '';
  return [item.productId, item.size ?? '', item.color ?? '', print].join('|');
}

/** Client-side cart, persisted to localStorage so it survives reloads. */
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((state) => {
          const key = lineKey(item);
          const quantity = item.quantity ?? 1;
          const existing = state.items.find((i) => i.key === key);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.key === key ? { ...i, quantity: clampQuantity(i.quantity + quantity) } : i,
              ),
            };
          }
          return { items: [...state.items, { ...item, key, quantity: clampQuantity(quantity) }] };
        }),
      setQuantity: (key, quantity) =>
        set((state) => ({
          items: state.items.map((i) => (i.key === key ? { ...i, quantity: clampQuantity(quantity) } : i)),
        })),
      remove: (key) => set((state) => ({ items: state.items.filter((i) => i.key !== key) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'redline-cart', storage: createJSONStorage(() => localStorage) },
  ),
);

/** Total number of units in the cart. */
export const selectCartCount = (state: CartState): number => state.items.reduce((n, i) => n + i.quantity, 0);
