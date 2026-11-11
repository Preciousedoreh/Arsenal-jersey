'use client';

import { useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

/** Shared look for admin text inputs. */
export const inputClass =
  'h-10 w-full rounded-btn border border-line bg-white px-3 text-sm outline-none transition-colors placeholder:text-ink/35 focus:border-ink focus:ring-1 focus:ring-ink disabled:bg-surface disabled:text-ink/50';
export const textareaClass = cn(inputClass, 'h-auto min-h-24 py-2 leading-relaxed');

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="headline text-3xl md:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink/60">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, children, className }: { title?: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('border border-line bg-white p-5 sm:p-6', className)}>
      {title && (
        <div className="mb-4">
          <h2 className="eyebrow text-ink">{title}</h2>
          {description && <p className="mt-1 text-micro text-muted">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Label + control + hint/error, wired for accessibility. Pass the control as a render function to get its id. */
export function FormField({
  label,
  hint,
  error,
  className,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="eyebrow block text-ink/70">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-micro font-medium text-primary">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-micro text-muted">{hint}</p>
      )}
    </div>
  );
}

const pillTones = {
  green: 'border-emerald-700/25 bg-emerald-50 text-emerald-800',
  red: 'border-primary/30 bg-primary/5 text-primary',
  gold: 'border-gold/40 bg-gold/10 text-gold',
  grey: 'border-ink/15 bg-surface text-ink/60',
} as const;

export function Pill({ tone = 'grey', children }: { tone?: keyof typeof pillTones; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-tiny font-bold uppercase tracking-label', pillTones[tone])}>{children}</span>;
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-10 text-sm text-ink/60">
      <LoaderCircle aria-hidden className="size-4 animate-spin" /> {label}
    </p>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'success'; children: React.ReactNode }) {
  const Icon = tone === 'error' ? AlertCircle : CheckCircle2;
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2 border p-3 text-sm', tone === 'error' ? 'border-primary/30 bg-primary/5 text-primary' : 'border-emerald-700/25 bg-emerald-50 text-emerald-800')}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Native <dialog> confirmation (focus trap and Esc come for free). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,26rem)] border-0 bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/60"
    >
      <div className="p-6">
        <h2 id="confirm-title" className="headline text-2xl">
          {title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-ink/70">{message}</div>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

/** Dollars (as typed) → integer cents, or null if it isn't a valid non-negative amount. */
export function dollarsToCents(value: string): number | null {
  const n = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(n) && n >= 0 && value.trim() !== '' ? Math.round(n * 100) : null;
}
export const centsToDollars = (cents: number) => (cents / 100).toFixed(2);
