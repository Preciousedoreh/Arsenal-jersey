'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Container } from '@/components/ui/Container';
import { CheckoutForm } from './CheckoutForm';
import { CheckoutSteps, type StepNumber } from './CheckoutSteps';
import { fieldId } from './Field';
import { OrderConfirmation } from './OrderConfirmation';
import { OrderSummary } from './OrderSummary';
import {
  FIELD_ORDER,
  deliveryCost,
  deliveryOptions,
  emptyValues,
  getSubtotal,
  makeReference,
  validateCheckout,
  type CheckoutValues,
  type Receipt,
} from '@/lib/checkout';
import { useCart } from '@/lib/cart-store';
import { useHasMounted } from '@/lib/hooks';

type Phase = 'details' | 'processing' | 'done';

/** Stand-in for the payment + order API round trip. */
const SIMULATED_PROCESSING_MS = 1400;

const STEP_FOR_PHASE: Record<Phase, StepNumber> = { details: 2, processing: 3, done: 4 };

/**
 * The whole checkout page: validates the form, shows the live order summary from the cart store,
 * and (for now) simulates placing the order. To go live, replace the simulated delay in `onSubmit`
 * with: create the order (POST /api/orders), start payment (POST /api/orders/:id/pay), then show the result.
 */
export function CheckoutExperience() {
  const items = useCart((s) => s.items);
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const clear = useCart((s) => s.clear);
  const mounted = useHasMounted(); // the cart lives in localStorage, so it's only known after hydration

  const [values, setValues] = useState<CheckoutValues>(emptyValues);
  const [attempted, setAttempted] = useState(false);
  const [phase, setPhase] = useState<Phase>('details');
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  // Once the customer has tried to submit, errors update live as they fix each field.
  const errors = useMemo(() => (attempted ? validateCheckout(values) : {}), [attempted, values]);
  const hasErrors = Object.keys(errors).length > 0;

  const subtotal = getSubtotal(items);
  const option = deliveryOptions.find((o) => o.id === values.delivery) ?? deliveryOptions[0]!;
  const delivery = deliveryCost(option, subtotal);

  const setField = <K extends keyof CheckoutValues>(name: K, value: CheckoutValues[K]) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (phase !== 'details' || items.length === 0) return;

    setAttempted(true);
    const found = validateCheckout(values);
    const firstInvalid = FIELD_ORDER.find((name) => found[name]);
    if (firstInvalid) {
      document.getElementById(fieldId(firstInvalid))?.focus();
      return;
    }

    setPhase('processing');
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_PROCESSING_MS));

    setReceipt({
      reference: makeReference(),
      email: values.email.trim(),
      firstName: values.firstName.trim(),
      city: values.city.trim(),
      items,
      subtotal,
      delivery,
      total: subtotal + delivery,
      deliveryLabel: option.label,
      deliveryDetail: option.detail,
    });
    clear();
    setPhase('done');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showEmptyCart = mounted && items.length === 0 && phase !== 'done';

  return (
    <Container className="py-8 md:py-12">
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <h1 className="headline text-[clamp(3rem,7vw,4.5rem)]">{phase === 'done' ? 'Thank you' : 'Checkout'}</h1>
        <CheckoutSteps current={STEP_FOR_PHASE[phase]} />
      </div>

      {phase === 'done' && receipt ? (
        <OrderConfirmation receipt={receipt} />
      ) : showEmptyCart ? (
        <section aria-labelledby="empty-title" className="mx-auto max-w-xl border border-line bg-white p-10 text-center">
          <h2 id="empty-title" className="headline text-3xl">
            Your cart is empty
          </h2>
          <p className="mt-3 text-sm text-ink/70">Add a kit or two and come back to check out.</p>
          <Button href="/" arrow className="mt-6">
            Shop new kits
          </Button>
        </section>
      ) : (
        <form
          noValidate
          onSubmit={onSubmit}
          aria-busy={phase === 'processing'}
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23.5rem] xl:grid-cols-[minmax(0,1fr)_26rem]"
        >
          <CheckoutForm values={values} errors={errors} subtotal={subtotal} disabled={phase === 'processing'} setField={setField} />
          <OrderSummary
            className="lg:sticky lg:top-6"
            items={items}
            loading={!mounted}
            delivery={delivery}
            processing={phase === 'processing'}
            showFormError={attempted && hasErrors}
            onQuantityChange={setQuantity}
            onRemove={remove}
          />
        </form>
      )}
    </Container>
  );
}
