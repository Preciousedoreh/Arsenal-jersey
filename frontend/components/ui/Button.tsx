import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'gold' | 'outline-light';
type Size = 'sm' | 'md';

const base =
  'group inline-flex items-center justify-center gap-2 rounded-btn font-semibold uppercase tracking-label transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-ink/15 bg-white text-ink hover:border-ink',
  gold: 'bg-gold text-white hover:bg-gold-light hover:text-ink',
  'outline-light': 'border border-white/40 text-white hover:bg-white hover:text-ink',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-tiny',
  md: 'h-11 px-6 text-micro',
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  /** Show the trailing arrow (nudges right on hover). */
  arrow?: boolean;
  fullWidth?: boolean;
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = CommonProps &
  ({ href: string } | (Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & { href?: undefined }));

/** Rectangular, uppercase, letter-spaced button. Renders a link when `href` is given. */
export function Button({ variant = 'primary', size = 'md', arrow = false, fullWidth = false, className, children, ...rest }: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className);
  const content = (
    <>
      {children}
      {arrow && <ArrowRight aria-hidden className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />}
    </>
  );

  if ('href' in rest && rest.href !== undefined) {
    return (
      <Link href={rest.href} className={classes}>
        {content}
      </Link>
    );
  }
  const { type = 'button', ...buttonProps } = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button type={type} className={classes} {...buttonProps}>
      {content}
    </button>
  );
}
