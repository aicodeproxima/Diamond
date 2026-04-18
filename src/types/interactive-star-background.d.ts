declare module 'interactive-star-background' {
  import type { ComponentType, CSSProperties } from 'react';

  export interface OrbConfig {
    x: number;
    y: number;
    r: number;
    hue: number;
    speed: number;
  }

  export interface ParticleBackgroundProps {
    fixed?: boolean;
    zIndex?: number;
    className?: string;
    style?: CSSProperties;
    particleCount?: number;
    starCount?: number;
    maxDpr?: number;
    mobileMaxDpr?: number;
    mobileBreakpoint?: number;
    interactive?: boolean;
    starHueRange?: [number, number];
    particleHueRange?: [number, number];
    orbs?: OrbConfig[] | false;
    mouseGlowHue?: number;
    connections?: boolean;
  }

  export const ParticleBackground: ComponentType<ParticleBackgroundProps>;
  const _default: ComponentType<ParticleBackgroundProps>;
  export default _default;
}
