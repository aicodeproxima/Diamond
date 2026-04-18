'use client';

import dynamic from 'next/dynamic';

/**
 * Dynamic import of ParticleBackground from the interactive-star-background
 * package. SSR is disabled because the component uses <canvas> and mouse
 * listeners that only exist in the browser.
 *
 * Rendered inside the starfield theme only.
 */
const ParticleBackground = dynamic(
  () =>
    import('interactive-star-background').then(
      (mod) => mod.ParticleBackground ?? mod.default,
    ),
  { ssr: false },
);

interface StarfieldBackgroundProps {
  /**
   * When true (default), canvas is position: fixed across the whole
   * viewport. Set false to fill the nearest positioned ancestor
   * instead — useful when scoping the starfield to a single page.
   */
  fixed?: boolean;
}

export function StarfieldBackground({ fixed = true }: StarfieldBackgroundProps = {}) {
  return (
    <ParticleBackground
      fixed={fixed}
      zIndex={0}
      starHueRange={[260, 300]}
      particleHueRange={[265, 305]}
      mouseGlowHue={280}
    />
  );
}
