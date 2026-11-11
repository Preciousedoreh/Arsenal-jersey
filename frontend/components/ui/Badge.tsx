import { cn } from '@/lib/utils';

type Tone = 'red' | 'gold' | 'dark' | 'outline-light';

const tones: Record<Tone, string> = {
  red: 'bg-primary text-white',
  gold: 'bg-gold text-white',
  dark: 'bg-ink text-white',
  'outline-light': 'border border-white/40 text-white',
};

/** Tiny uppercase tag ("NEW", "LIMITED STOCK", "NEW DROP"). */
export function Badge({ tone = 'red', className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-[2px] px-2 py-0.5 text-tiny font-bold uppercase tracking-label', tones[tone], className)}>
      {children}
    </span>
  );
}
