'use client';

import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import { MSWProvider } from './MSWProvider';
import { usePreferencesStore, applyThemeToDOM } from '@/lib/stores/preferences-store';
import { GoldStarTrail } from './GoldStarTrail';
import { StarfieldBackground } from './StarfieldBackground';

/**
 * Applies the persisted color theme on mount so the CSS custom
 * properties are set before the first paint.
 */
function ThemeApplier() {
  const colorTheme = usePreferencesStore((s) => s.colorTheme);
  useEffect(() => {
    applyThemeToDOM(colorTheme);
  }, [colorTheme]);
  return null;
}

/**
 * Mounts per-theme visual effects. Each effect subtree is conditionally
 * rendered so it fully unmounts (and tears down listeners/canvas) the
 * moment the user switches themes.
 */
function ThemeEffects() {
  const colorTheme = usePreferencesStore((s) => s.colorTheme);
  if (colorTheme === 'marble') {
    return <GoldStarTrail />;
  }
  if (colorTheme === 'starfield') {
    return (
      <>
        <StarfieldBackground />
        <GoldStarTrail />
      </>
    );
  }
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MSWProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <ThemeApplier />
        <ThemeEffects />
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            className: '!bg-card !text-card-foreground !border !border-border',
            duration: 3000,
          }}
        />
      </ThemeProvider>
    </MSWProvider>
  );
}
