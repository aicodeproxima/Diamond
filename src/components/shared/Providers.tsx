'use client';

import { useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'react-hot-toast';
import { MSWProvider } from './MSWProvider';
import { usePreferencesStore, applyThemeToDOM } from '@/lib/stores/preferences-store';
import { GoldStarTrail } from './GoldStarTrail';

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
 * Mounts extra visual effects only when the marble theme is active.
 * Re-keyed when the theme changes so the GoldStarTrail fully tears down.
 */
function MarbleEffects() {
  const colorTheme = usePreferencesStore((s) => s.colorTheme);
  if (colorTheme !== 'marble') return null;
  return <GoldStarTrail />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MSWProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <ThemeApplier />
        <MarbleEffects />
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
