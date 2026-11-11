import { notifications } from '../services/notifications.js';

export interface StockChange {
  name: string;
  sku: string;
  /** Stock after the change. */
  stockQuantity: number;
  lowStockThreshold: number;
  /** Signed change that was just applied (negative = stock went down). */
  change: number;
}

/**
 * Only alert when stock *crosses* the threshold downward, so admins get one email
 * per product per dip instead of one for every order while it stays low.
 */
export function crossedLowStock(c: StockChange): boolean {
  const before = c.stockQuantity - c.change;
  return c.change < 0 && c.stockQuantity <= c.lowStockThreshold && before > c.lowStockThreshold;
}

export async function alertIfLowStock(changes: StockChange[]): Promise<void> {
  const crossed = changes.filter(crossedLowStock);
  await notifications.lowStock(
    crossed.map(({ name, sku, stockQuantity, lowStockThreshold }) => ({
      name,
      sku,
      stockQuantity,
      lowStockThreshold,
    })),
  );
}
