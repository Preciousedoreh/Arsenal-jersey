'use client';

import { useEffect, useState } from 'react';
import { cn, pad2 } from '@/lib/utils';

/** When the next drop happens (local time). Recurring, so the timer always has a future target. */
export type DropSchedule =
  | { kind: 'daily'; hour: number }
  | { kind: 'weekly'; weekday: number; hour: number } // weekday: 0 = Sunday
  | { kind: 'date'; iso: string };

type Unit = 'days' | 'hours' | 'minutes' | 'seconds';

const UNIT_LABEL: Record<Unit, string> = { days: 'Days', hours: 'Hrs', minutes: 'Min', seconds: 'Sec' };
const MS = { second: 1000, minute: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

export function nextOccurrence(schedule: DropSchedule, now: Date): Date {
  if (schedule.kind === 'date') return new Date(schedule.iso);
  const target = new Date(now);
  target.setHours(schedule.hour, 0, 0, 0);
  if (schedule.kind === 'daily') {
    if (target <= now) target.setDate(target.getDate() + 1);
    return target;
  }
  const daysAhead = (schedule.weekday - now.getDay() + 7) % 7;
  target.setDate(target.getDate() + daysAhead);
  if (target <= now) target.setDate(target.getDate() + 7);
  return target;
}

/** Splits the remaining time into the requested units; the largest unit absorbs the rest. */
function split(ms: number, units: Unit[]): Record<Unit, number> {
  let rest = Math.max(0, ms);
  const out = { days: 0, hours: 0, minutes: 0, seconds: 0 };
  if (units.includes('days')) {
    out.days = Math.floor(rest / MS.day);
    rest -= out.days * MS.day;
  }
  out.hours = Math.floor(rest / MS.hour);
  rest -= out.hours * MS.hour;
  out.minutes = Math.floor(rest / MS.minute);
  rest -= out.minutes * MS.minute;
  out.seconds = Math.floor(rest / MS.second);
  return out;
}

interface CountdownProps {
  schedule: DropSchedule;
  units?: Unit[];
  /** Accessible name, e.g. "Time until next drop". */
  label: string;
  className?: string;
  /** Extra classes for each number. */
  digitClassName?: string;
}

/**
 * Live countdown (ticks every second). The server renders "--" placeholders and the real time
 * appears after mount, so there is never a hydration mismatch. `role="timer"` is not announced
 * on every tick, which keeps screen readers quiet.
 */
export function Countdown({ schedule, units = ['hours', 'minutes', 'seconds'], label, className, digitClassName }: CountdownProps) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const target = { current: nextOccurrence(schedule, new Date()) };
    const tick = () => {
      const now = new Date();
      // Roll over to the next recurrence once a drop goes live.
      if (now >= target.current && schedule.kind !== 'date') target.current = nextOccurrence(schedule, now);
      setRemaining(target.current.getTime() - now.getTime());
    };
    tick();
    const timer = setInterval(tick, MS.second);
    return () => clearInterval(timer);
  }, [schedule]);

  const parts = remaining === null ? null : split(remaining, units);

  return (
    <div role="timer" aria-label={label} className={cn('flex items-start gap-2 sm:gap-3', className)}>
      {units.map((unit, i) => (
        <div key={unit} className="flex items-start gap-2 sm:gap-3">
          {i > 0 && (
            <span aria-hidden className={cn('headline opacity-60', digitClassName)}>
              :
            </span>
          )}
          <div className="flex flex-col items-center">
            <span className={cn('headline tabular-nums', digitClassName)}>{parts ? pad2(parts[unit]) : '--'}</span>
            <span className="mt-1 text-tiny font-semibold uppercase tracking-label opacity-70">{UNIT_LABEL[unit]}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
