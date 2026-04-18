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

export function StarfieldBackground() {
  // Defaults match the package's purple palette; we lift the z-index to -1
  // so it sits behind all app content even inside stacking contexts.
  return (
    <ParticleBackground
      zIndex={-1}
      starHueRange={[260, 300]}
      particleHueRange={[265, 305]}
      mouseGlowHue={280}
    />
  );
}
