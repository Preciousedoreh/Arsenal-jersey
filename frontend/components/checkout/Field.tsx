import { cn } from '@/lib/utils';

/** DOM id for a checkout field — also used to move focus to the first invalid field on submit. */
export const fieldId = (name: string) => `checkout-${name}`;

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id' | 'name'> {
  name: string;
  label: string;
  error?: string;
}

/** Labelled text input with an inline error, wired up with aria-invalid / aria-describedby. */
export function Field({ name, label, error, className, ...input }: FieldProps) {
  const id = fieldId(name);
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="eyebrow block text-ink/60">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={cn(
          'mt-1.5 h-11 w-full rounded-btn border bg-white px-3.5 text-sm outline-none transition-colors placeholder:text-ink/35 focus:ring-1',
          error
            ? 'border-primary bg-primary/[0.03] focus:border-primary focus:ring-primary'
            : 'border-line focus:border-ink focus:ring-ink',
        )}
        {...input}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-micro font-medium text-primary">
          {error}
        </p>
      )}
    </div>
  );
}
