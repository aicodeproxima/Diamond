import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind-aware class-name merger. Moved from src/lib/utils.ts into
 * the utils folder barrel (audit L-7). Existing `import { cn } from
 * '@/lib/utils'` continues to resolve via the folder's index.ts.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
