'use client';

import { useReducedMotion } from 'framer-motion';

/**
 * Thin wrapper around framer-motion's `useReducedMotion` that returns
 * sensible defaults for common animation primitives when the user has
 * requested reduced motion via their OS (`prefers-reduced-motion:
 * reduce`).
 *
 * Usage:
 *   const rm = useMotionDefaults();
 *   <motion.div initial={rm.fadeIn.initial} animate={rm.fadeIn.animate}>
 */
export function useMotionDefaults() {
  const reduced = useReducedMotion() ?? false;

  return {
    reduced,
    /** Fade-in: disabled when reduced-motion is set. */
    fadeIn: {
      initial: reduced ? { opacity: 1 } : { opacity: 0 },
      animate: { opacity: 1 },
      exit: reduced ? { opacity: 1 } : { opacity: 0 },
      transition: reduced ? { duration: 0 } : { duration: 0.2 },
    },
    /** Slide-in from below. Collapses to a plain opacity transition. */
    slideUp: {
      initial: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
      transition: reduced ? { duration: 0 } : { duration: 0.2 },
    },
  };
}
