'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

/**
 * Root redirect. Uses the auth store's `hydrate()` so the cookie
 * mirror (audit C-2) is refreshed before we navigate — this avoids a
 * redirect loop where localStorage still has a valid token but the
 * session cookie has expired, leaving the middleware to bounce the
 * user back to /login mid-flow.
 */
export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(isAuthenticated ? '/dashboard' : '/login');
  }, [hydrated, isAuthenticated, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}
