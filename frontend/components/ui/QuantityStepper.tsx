'use client';

import { Minus, Plus } from 'lucide-react';
import { MAX_LINE_QUANTITY } from '@/lib/cart-store';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  /** `sm` is the compact variant used in the checkout order summary. */
  size?: 'sm' | 'md';
}

/** − [n] + stepper. Buttons disable at the bounds; the value is announced politely. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = MAX_LINE_QUANTITY,
  label = 'Quantity',
  size = 'md',
}: QuantityStepperProps) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  const small = size === 'sm';
  const btn = cn(
    'grid place-items-center text-ink transition-colors hover:bg-surface disabled:text-ink/25 disabled:hover:bg-transparent',
    small ? 'size-7' : 'size-9',
  );
  return (
    <div role="group" aria-label={label} className="inline-flex items-center rounded-btn border border-line">
      <button type="button" className={btn} onClick={() => set(value - 1)} disabled={value <= min} aria-label={`Decrease ${label.toLowerCase()}`}>
        <Minus aria-hidden className={small ? 'size-3' : 'size-3.5'} />
      </button>
      <output aria-live="polite" className={cn('text-center font-semibold tabular-nums', small ? 'w-7 text-xs' : 'w-9 text-sm')}>
        {value}
      </output>
      <button type="button" className={btn} onClick={() => set(value + 1)} disabled={value >= max} aria-label={`Increase ${label.toLowerCase()}`}>
        <Plus aria-hidden className={small ? 'size-3' : 'size-3.5'} />
      </button>
    </div>
  );
}
