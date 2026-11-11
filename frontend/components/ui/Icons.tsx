/**
 * Brand marks for social networks and payment methods. lucide-react no longer ships brand icons,
 * so these are small inline SVGs. All are decorative (aria-hidden); the parent supplies the label.
 */

type IconProps = { className?: string };

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L2 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11.1 14.5Z" />
    </svg>
  );
}

export function FacebookIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.9Z" />
    </svg>
  );
}

export function YouTubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  );
}

/** Simplified payment-method badges for the footer. */
export function PaymentBadge({ method }: { method: 'visa' | 'paypal' | 'mastercard' | 'applepay' }) {
  const frame = 'flex h-7 w-11 items-center justify-center rounded-[3px] bg-white';
  switch (method) {
    case 'visa':
      return (
        <span className={frame}>
          <span className="text-[10px] font-black italic tracking-tight text-navy">VISA</span>
        </span>
      );
    case 'paypal':
      return (
        <span className={frame}>
          <span className="text-[9px] font-bold italic text-navy">
            Pay<span className="text-[#009cde]">Pal</span>
          </span>
        </span>
      );
    case 'mastercard':
      return (
        <span className={frame}>
          <svg viewBox="0 0 32 20" aria-hidden className="h-4">
            <circle cx="12" cy="10" r="7" fill="#eb001b" />
            <circle cx="20" cy="10" r="7" fill="#f79e1b" fillOpacity=".9" />
          </svg>
        </span>
      );
    case 'applepay':
      return (
        <span className={frame}>
          <span className="text-[8px] font-semibold leading-none text-ink">Apple Pay</span>
        </span>
      );
  }
}
