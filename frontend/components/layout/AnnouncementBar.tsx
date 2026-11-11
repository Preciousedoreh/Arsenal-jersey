import { siteConfig } from '@/lib/site';
import { cn } from '@/lib/utils';

/** Thin strip above the header. Red on the storefront, near-black on checkout. */
export function AnnouncementBar({ tone = 'red' }: { tone?: 'red' | 'dark' }) {
  return (
    <div className={cn('text-white', tone === 'red' ? 'bg-primary' : 'bg-ink')}>
      <p className="mx-auto flex h-8 max-w-site items-center justify-center gap-2 px-4 text-tiny font-semibold uppercase tracking-wide-label sm:gap-3">
        {siteConfig.announcement.map((item, i) => (
          <span key={item} className={i > 0 ? 'hidden items-center gap-2 sm:flex sm:gap-3' : 'flex'}>
            {i > 0 && <span aria-hidden className="text-gold-light">•</span>}
            {item}
          </span>
        ))}
      </p>
    </div>
  );
}
