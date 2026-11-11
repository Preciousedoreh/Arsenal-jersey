import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SectionHeadingProps {
  title: string;
  /** Optional "VIEW ALL →" link on the right. */
  viewAllHref?: string;
  /** Small label variant (e.g. "FEATURED KITS"). */
  small?: boolean;
  id?: string;
  className?: string;
}

/** Uppercase, left-aligned section title with an optional "view all" link. */
export function SectionHeading({ title, viewAllHref, small = false, id, className }: SectionHeadingProps) {
  return (
    <div className={cn('mb-6 flex items-end justify-between gap-4 md:mb-8', className)}>
      <h2 id={id} className={small ? 'eyebrow text-ink/70' : 'headline text-3xl md:text-4xl'}>
        {title}
      </h2>
      {viewAllHref && (
        <Link href={viewAllHref} className="group eyebrow flex shrink-0 items-center gap-1.5 text-ink/70 transition-colors hover:text-primary">
          View all
          <ArrowRight aria-hidden className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
