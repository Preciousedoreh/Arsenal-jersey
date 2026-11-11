/** Formats integer minor units (e.g. cents) for display. Never use floats for stored money. */
export function formatMoney(cents: number, currency: string): string {
  const digits =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(cents / 10 ** digits);
}
