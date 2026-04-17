'use client';

import {
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

/**
 * External-store topbar slot (audit follow-up: calendar nav block).
 *
 * Previously a React Context + useState pair. That design caused a
 * pathological re-render cycle on /calendar: the calendar page passes
 * unstable deps to `useTopbarSlot` (a fresh `navigate` function and a
 * fresh `rooms` array each render), so the effect re-ran on every
 * render, called `setContent(newJsx)`, which bubbled through the
 * context Provider and re-rendered the whole subtree — including the
 * calendar page itself. React couldn't commit the client-router
 * transition away from /calendar because the tree was effectively
 * busy. Users saw sidebar clicks "do nothing".
 *
 * This rewrite keeps the content in a module-level ref and uses a
 * monotonic version counter for `useSyncExternalStore`. Consumers
 * (`Topbar`) subscribe and re-render when the version changes;
 * producers (pages via `useTopbarSlot`) update the ref without
 * triggering any parent re-renders. The calendar can now re-render
 * internally as often as it likes without poisoning navigation.
 *
 * The exported `TopbarSlotProvider` is now a no-op pass-through; kept
 * as a symbol so the existing dashboard layout import still resolves.
 */

let currentContent: ReactNode = null;
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return version;
}

function getServerSnapshot() {
  return 0;
}

export function TopbarSlotProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** Read-only access used by Topbar itself. */
export function useTopbarSlotContent(): ReactNode {
  // Subscribe to the version so Topbar re-renders when slot changes.
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return currentContent;
}

/**
 * Hook for pages: pass JSX to mount into the topbar. The effect
 * depends on the caller's `deps` array; when they change, we update
 * the module-level ref and notify the Topbar alone — the calling
 * page tree is NOT re-rendered, so navigation away is never blocked.
 */
export function useTopbarSlot(node: ReactNode, deps: React.DependencyList) {
  useEffect(() => {
    currentContent = node;
    notify();
    return () => {
      currentContent = null;
      notify();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
