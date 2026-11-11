import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const MAX_STARS = 5;

interface StarRatingProps {
  rating: number;
  /** Shown after the stars, e.g. "(4.8)" or "412". */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Gold star rating with an accessible text equivalent. */
export function StarRating({ rating, label, size = 'sm', className }: StarRatingProps) {
  const iconSize = size === 'sm' ? 'size-3' : 'size-4';
  return (
    // `relative` matters: the .sr-only text below is position:absolute, and without a positioned
    // parent it escapes overflow clipping (e.g. inside the scrolling testimonials carousel) and
    // stretches the whole page horizontally.
    <div className={cn('relative flex items-center gap-1.5', className)}>
      <span className="sr-only">{`Rated ${rating} out of ${MAX_STARS}`}</span>
      <span aria-hidden className="flex items-center gap-0.5">
        {Array.from({ length: MAX_STARS }, (_, i) => (
          <Star key={i} className={cn(iconSize, i < Math.round(rating) ? 'fill-gold text-gold' : 'fill-line text-line')} />
        ))}
      </span>
      {label && <span className="text-micro text-muted">{label}</span>}
    </div>
  );
}
