'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { useTopbarSlotContent } from './TopbarSlot';

interface TopbarProps {
  onMenuClick?: () => void;
  title?: string;
}

export function Topbar({ onMenuClick, title }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const slot = useTopbarSlotContent();

  useEffect(() => setMounted(true), []);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md sm:px-6">
      {onMenuClick && (
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      )}
      {title && <h1 className="text-lg font-semibold">{title}</h1>}
      {/* Page-provided toolbar — set via useTopbarSlot(). Takes the whole
          middle of the bar so pages like /calendar can embed their own
          controls without adding a second row. */}
      <div className="flex min-w-0 flex-1 items-center gap-3">{slot}</div>
      <div className="flex items-center gap-2">
        {mounted && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Moon className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        )}
      </div>
    </header>
  );
}
