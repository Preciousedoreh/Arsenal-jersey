/** Name & number printing rules, shared by the home-page customizer and the product pages. */

export const NAME_MAX = 12;
export const NUMBER_MAX = 2;
/** Added to the unit price when a shirt is personalised. */
export const PRINT_PRICE = 15;

/** Letters, spaces, apostrophes, dots and hyphens — what a shirt printer accepts. */
export const sanitizeName = (v: string): string =>
  v.replace(/[^\p{L} .'-]/gu, '').toUpperCase().slice(0, NAME_MAX);

export const sanitizeNumber = (v: string): string => v.replace(/\D/g, '').slice(0, NUMBER_MAX);
