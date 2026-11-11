import type { CartItem } from '@/types';
import { EMAIL_PATTERN } from './utils';

/*
 * Checkout rules, pricing and validation. Pure functions with no React or browser dependencies,
 * so they are easy to test and to reuse when the real order API is connected.
 */

// ───────────── Delivery & pricing ─────────────

/** Standard delivery is free from this subtotal up — matches the "FREE SHIPPING OVER $100" banner. */
export const FREE_DELIVERY_THRESHOLD = 100;

export type DeliveryId = 'standard' | 'express' | 'next-day';
export type PaymentMethod = 'card' | 'paypal' | 'applepay';

export interface DeliveryOption {
  id: DeliveryId;
  label: string;
  detail: string;
  /** Price in whole dollars. */
  price: number;
  /** Delivery is free when the subtotal reaches this amount. */
  freeFrom?: number;
}

export const deliveryOptions: readonly DeliveryOption[] = [
  { id: 'standard', label: 'Standard', detail: '3–5 business days', price: 6, freeFrom: FREE_DELIVERY_THRESHOLD },
  { id: 'express', label: 'Express', detail: '1–2 business days', price: 12 },
  { id: 'next-day', label: 'Next day', detail: 'Order before 2pm', price: 22 },
];

export const paymentMethods: readonly { id: PaymentMethod; label: string }[] = [
  { id: 'card', label: 'Card' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'applepay', label: 'Apple Pay' },
];

export function deliveryCost(option: DeliveryOption, subtotal: number): number {
  return option.freeFrom !== undefined && subtotal >= option.freeFrom ? 0 : option.price;
}

export const getSubtotal = (items: readonly CartItem[]): number =>
  items.reduce((cents, item) => cents + Math.round(item.price * 100) * item.quantity, 0) / 100;

export const getUnitCount = (items: readonly CartItem[]): number =>
  items.reduce((sum, item) => sum + item.quantity, 0);

/** "Size M · White" / "Size L · Print: RAY 10" */
export function describeItem(item: CartItem): string {
  return [
    item.size && (item.size === 'OS' ? 'One size' : `Size ${item.size}`),
    item.color,
    item.customization && `Print: ${[item.customization.name, item.customization.number].filter(Boolean).join(' ')}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ───────────── Form model ─────────────

export interface CheckoutValues {
  email: string;
  newsletter: boolean;
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  postcode: string;
  phone: string;
  delivery: DeliveryId;
  method: PaymentMethod;
  cardNumber: string;
  expiry: string;
  cvc: string;
  cardName: string;
}

export const emptyValues: CheckoutValues = {
  email: '',
  newsletter: false,
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  postcode: '',
  phone: '',
  delivery: 'standard',
  method: 'card',
  cardNumber: '',
  expiry: '',
  cvc: '',
  cardName: '',
};

/** Fields that hold text and can show an error, in page order (used to focus the first invalid one). */
export const FIELD_ORDER = [
  'email',
  'firstName',
  'lastName',
  'address',
  'city',
  'postcode',
  'phone',
  'cardNumber',
  'expiry',
  'cvc',
  'cardName',
] as const;

export type FieldName = (typeof FIELD_ORDER)[number];
export type CheckoutErrors = Partial<Record<FieldName, string>>;

// ───────────── Input formatting ─────────────

const MAX_CARD_DIGITS = 19;

/** "4242424242424242" → "4242 4242 4242 4242" */
export function formatCardNumber(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, MAX_CARD_DIGITS);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/** "1226" → "12 / 26"; a lone "4" becomes "04" since no month starts with 4. */
export function formatExpiry(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 1) return digits > '1' ? `0${digits}` : digits;
  if (digits.length === 2) return digits;
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`;
}

// ───────────── Validation ─────────────

/** Luhn checksum — catches mistyped card numbers before they reach the payment provider. */
export function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

const isBlank = (v: string) => v.trim().length === 0;

export function validateCheckout(values: CheckoutValues, now: Date = new Date()): CheckoutErrors {
  const errors: CheckoutErrors = {};

  if (isBlank(values.email)) errors.email = 'Enter your email address.';
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'That email address doesn’t look right.';

  if (isBlank(values.firstName)) errors.firstName = 'Enter your first name.';
  if (isBlank(values.lastName)) errors.lastName = 'Enter your last name.';

  if (isBlank(values.address)) errors.address = 'Enter your street address.';
  else if (values.address.trim().length < 3) errors.address = 'That address looks too short.';

  if (isBlank(values.city)) errors.city = 'Enter your city.';

  if (isBlank(values.postcode)) errors.postcode = 'Enter your postcode.';
  else if (!/^[A-Za-z0-9][A-Za-z0-9 -]{1,8}[A-Za-z0-9]$/.test(values.postcode.trim())) {
    errors.postcode = 'Enter a valid postcode.';
  }

  const phone = values.phone.trim();
  const phoneDigits = phone.replace(/\D/g, '');
  if (!phone) errors.phone = 'Enter a phone number for the courier.';
  else if (!/^[+()\d\s-]+$/.test(phone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.phone = 'Enter a valid phone number.';
  }

  // Card details are only required when paying by card.
  if (values.method === 'card') {
    const number = values.cardNumber.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(number) || !passesLuhn(number)) errors.cardNumber = 'Enter a valid card number.';

    const match = /^(\d{2}) \/ (\d{2})$/.exec(values.expiry);
    if (!match) {
      errors.expiry = 'Enter the expiry as MM / YY.';
    } else {
      const month = Number(match[1]);
      const year = 2000 + Number(match[2]);
      if (month < 1 || month > 12) errors.expiry = 'Enter a valid month (01–12).';
      else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
        errors.expiry = 'This card has expired.';
      }
    }

    if (!/^\d{3,4}$/.test(values.cvc)) errors.cvc = 'Enter the 3 or 4 digit code.';
    if (isBlank(values.cardName)) errors.cardName = 'Enter the name on your card.';
  }

  return errors;
}

// ───────────── Receipt ─────────────

/** Snapshot of a placed order, kept after the cart is cleared so the confirmation can show it. */
export interface Receipt {
  reference: string;
  email: string;
  firstName: string;
  city: string;
  items: CartItem[];
  subtotal: number;
  delivery: number;
  total: number;
  deliveryLabel: string;
  deliveryDetail: string;
}

/** Short human-friendly order reference, e.g. "RL-4F9A2C1B". (Replace with the API's order id.) */
export function makeReference(): string {
  return `RL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
