'use client';

import { Lock } from 'lucide-react';
import { CheckoutSection } from './CheckoutSection';
import { Field } from './Field';
import {
  deliveryCost,
  deliveryOptions,
  formatCardNumber,
  formatExpiry,
  paymentMethods,
  type CheckoutErrors,
  type CheckoutValues,
} from '@/lib/checkout';
import { cn, formatPriceExact } from '@/lib/utils';

type TextField = 'email' | 'firstName' | 'lastName' | 'address' | 'city' | 'postcode' | 'phone' | 'cardName';

interface CheckoutFormProps {
  values: CheckoutValues;
  errors: CheckoutErrors;
  subtotal: number;
  disabled: boolean;
  setField: <K extends keyof CheckoutValues>(name: K, value: CheckoutValues[K]) => void;
}

/**
 * The four numbered sections: contact, shipping address, delivery, payment.
 *
 * NOTE: the card inputs here are a UI mock. In production, never collect raw card numbers in your
 * own inputs — use the payment provider's hosted fields (e.g. Stripe Elements) so card data never
 * touches your server or this component's state.
 */
export function CheckoutForm({ values, errors, subtotal, disabled, setField }: CheckoutFormProps) {
  const text = (name: TextField) => ({
    name,
    value: values[name],
    error: errors[name],
    disabled,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setField(name, e.target.value),
  });

  return (
    <div className="space-y-5">
      {/* 1. Contact */}
      <CheckoutSection
        step={1}
        title="Contact"
        aside={
          <>
            Already have an account?{' '}
            <a href="#" className="font-bold text-ink underline underline-offset-2 hover:text-primary">
              Sign in
            </a>
          </>
        }
      >
        <Field {...text('email')} label="Email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" />
        <label className="mt-4 flex w-fit cursor-pointer items-center gap-2.5 text-micro text-ink/80">
          <input
            type="checkbox"
            checked={values.newsletter}
            disabled={disabled}
            onChange={(e) => setField('newsletter', e.target.checked)}
            className="size-4 accent-primary"
          />
          Email me about new kit drops
        </label>
      </CheckoutSection>

      {/* 2. Shipping address */}
      <CheckoutSection step={2} title="Shipping address">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field {...text('firstName')} label="First name" autoComplete="given-name" />
          <Field {...text('lastName')} label="Last name" autoComplete="family-name" />
        </div>
        <Field {...text('address')} className="mt-4" label="Address" autoComplete="address-line1" placeholder="Street and house number" />
        <div className="mt-4 grid gap-4 sm:grid-cols-[1.7fr_1fr]">
          <Field {...text('city')} label="City" autoComplete="address-level2" />
          <Field {...text('postcode')} label="Postcode" autoComplete="postal-code" />
        </div>
        <Field {...text('phone')} className="mt-4" label="Phone" type="tel" inputMode="tel" autoComplete="tel" />
      </CheckoutSection>

      {/* 3. Delivery */}
      <CheckoutSection step={3} title="Delivery">
        <fieldset disabled={disabled}>
          <legend className="sr-only">Delivery method</legend>
          <div className="space-y-3">
            {deliveryOptions.map((option) => {
              const cost = deliveryCost(option, subtotal);
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-3.5 border border-ink/25 px-4 py-3.5 transition-colors hover:border-ink has-checked:border-primary has-checked:bg-primary/[0.04] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
                >
                  <input
                    type="radio"
                    name="delivery"
                    value={option.id}
                    checked={values.delivery === option.id}
                    onChange={() => setField('delivery', option.id)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="block text-micro text-muted">{option.detail}</span>
                  </span>
                  <span className="text-sm font-bold">{cost === 0 ? 'FREE' : formatPriceExact(cost)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </CheckoutSection>

      {/* 4. Payment */}
      <CheckoutSection
        step={4}
        title="Payment"
        aside={
          <span className="flex items-center gap-1.5">
            <Lock aria-hidden className="size-3" /> Encrypted and secure
          </span>
        }
      >
        <fieldset disabled={disabled}>
          <legend className="sr-only">Payment method</legend>
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map((method) => (
              <label
                key={method.id}
                className={cn(
                  'grid h-11 cursor-pointer place-items-center border border-ink/25 text-xs font-semibold transition-colors',
                  'hover:border-ink has-checked:border-ink has-checked:bg-ink has-checked:text-white',
                  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary',
                )}
              >
                <input
                  type="radio"
                  name="method"
                  value={method.id}
                  checked={values.method === method.id}
                  onChange={() => setField('method', method.id)}
                  className="sr-only"
                />
                {method.label}
              </label>
            ))}
          </div>
        </fieldset>

        {values.method === 'card' ? (
          <div className="mt-5 space-y-4">
            <Field
              name="cardNumber"
              label="Card number"
              value={values.cardNumber}
              error={errors.cardNumber}
              disabled={disabled}
              onChange={(e) => setField('cardNumber', formatCardNumber(e.target.value))}
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="1234 1234 1234 1234"
              maxLength={23}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="expiry"
                label="Expiry"
                value={values.expiry}
                error={errors.expiry}
                disabled={disabled}
                onChange={(e) => setField('expiry', formatExpiry(e.target.value))}
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM / YY"
                maxLength={7}
              />
              <Field
                name="cvc"
                label="Security code"
                value={values.cvc}
                error={errors.cvc}
                disabled={disabled}
                onChange={(e) => setField('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="CVC"
                maxLength={4}
              />
            </div>
            <Field {...text('cardName')} label="Name on card" autoComplete="cc-name" />
          </div>
        ) : (
          <p className="mt-5 border border-line bg-surface p-4 text-sm text-ink/70">
            {values.method === 'paypal'
              ? 'You’ll be taken to PayPal to approve your payment securely, then brought back here.'
              : 'Confirm the payment with Face ID, Touch ID or your passcode on a supported Apple device.'}
          </p>
        )}
      </CheckoutSection>
    </div>
  );
}
