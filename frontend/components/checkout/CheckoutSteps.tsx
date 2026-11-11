import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['Cart', 'Details', 'Payment', 'Done'] as const;

export type StepNumber = 1 | 2 | 3 | 4;

/** Progress indicator: completed steps get a tick, the current step is red. */
export function CheckoutSteps({ current }: { current: StepNumber }) {
  return (
    <ol aria-label="Checkout progress" className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((label, i) => {
        const number = i + 1;
        const state = number < current ? 'done' : number === current ? 'active' : 'todo';
        return (
          <li key={label} aria-current={state === 'active' ? 'step' : undefined} className="flex items-center gap-2 sm:gap-3">
            {i > 0 && <span aria-hidden className="h-px w-3 bg-ink/20 sm:w-8" />}
            <span
              aria-hidden
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full text-tiny font-bold',
                state === 'done' && 'bg-ink text-white',
                state === 'active' && 'bg-primary text-white',
                state === 'todo' && 'border border-ink/30 text-ink/50',
              )}
            >
              {state === 'done' ? <Check className="size-3" strokeWidth={3} /> : number}
            </span>
            {/* On phones only the current step keeps a visible label (the rest wouldn't fit); the others stay readable to screen readers. */}
            <span className={cn('eyebrow', state === 'todo' ? 'text-ink/50' : 'text-ink', state !== 'active' && 'sr-only sm:not-sr-only')}>
              {label}
              {state === 'done' && <span className="sr-only"> (completed)</span>}
              {state === 'active' && <span className="sr-only"> (current step)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
