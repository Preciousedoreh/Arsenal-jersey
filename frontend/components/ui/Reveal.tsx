'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';

const OFFSET_PX = 24;
const DURATION_S = 0.6;

interface RevealProps extends HTMLMotionProps<'div'> {
  /** Stagger delay in seconds. */
  delay?: number;
  /** Slide in from this direction. */
  from?: 'bottom' | 'left' | 'right';
}

/**
 * Fades + slides its children in the first time they scroll into view.
 * With reduced motion (MotionConfig in Providers) only the opacity changes.
 */
export function Reveal({ delay = 0, from = 'bottom', children, ...props }: RevealProps) {
  const initial = from === 'bottom' ? { y: OFFSET_PX } : { x: from === 'left' ? -OFFSET_PX : OFFSET_PX };
  return (
    <motion.div
      initial={{ opacity: 0, ...initial }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: DURATION_S, delay, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
