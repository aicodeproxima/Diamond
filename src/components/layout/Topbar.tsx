'use client';

import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTopbarSlotContent } from './TopbarSlot';

interface TopbarProps {
  onMenuClick?: () => void;
  title?: string;
}

/**
 * Sticky top chrome rendered only on pages that register toolbar content
 * via `useTopbarSlot()` (currently just /calendar). The dark-mode toggle
 * lives in /settings — it is not a per-page control.
 */
export function Topbar({ onMenuClick, title }: TopbarProps) {
  const slot = useTopbarSlotContent();

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
    </header>
  );
}
