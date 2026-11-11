import { cn } from '@/lib/utils';

/** Centred content column (max 1280px) with responsive side gutters. */
export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-site px-4 sm:px-6 lg:px-8', className)}>{children}</div>;
}
