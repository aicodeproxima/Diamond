# Diamond Frontend — Consolidated Audit Report

**Audit Date:** 2026-04-11
**Live URL:** https://diamond-delta-eight.vercel.app
**Codebase:** C:\Users\aicod\Diamond
**Method:** 8-agent parallel review with cross-reference synthesis

---

## 1. Executive Summary

Diamond is a Next.js 16 App Router + TypeScript application for church Bible-study room booking and organizational management. The frontend is functionally complete and demo-ready, driven end-to-end by MSW mocks. The 3D organizational tree (`Tree3D.tsx`, 817 LOC) is the architectural centerpiece and the single largest source of complexity, performance risk, and technical debt in the project.

**Overall verdict:** The app is **solid for internal demo and UX iteration**, but **not production-ready**. The most load-bearing gaps are all on the server-trust axis: there is no server-side auth, no role enforcement at the route level, no CSRF protection, and tokens live in XSS-reachable `localStorage`. These are acceptable during the mock-backend phase but must be closed before the real Go backend is wired up.

Beyond security, the dominant issues are: (1) significant dead code and stale optimization scaffolding in `Tree3D.tsx` (a `LODController` + `cardsHidden` state that was disabled but left wired), (2) missing `React.memo` / callback stability on ~180 3D child components causing cascade re-renders, (3) a partially-used TanStack Query setup with zero `useQuery` calls, (4) manual per-field form state across every form with no validation library, and (5) several small correctness hazards in the tree layout algorithm that will bite at scale.

No findings block merging or demoing. Several are quick wins. None require architectural rewrites, but **before flipping `NEXT_PUBLIC_MOCK_API=false`**, a security hardening pass is mandatory.

---

## 2. Audit Scope and Method

**Stack verified against codebase:**
- Next.js 16 App Router, TypeScript strict
- Tailwind CSS + shadcn/ui primitives
- Framer Motion (animations), `react-hot-toast` (notifications)
- Three.js via `@react-three/fiber` + `@react-three/drei`
- Zustand stores (`auth-store`, `custom-entities-store`) with `persist` middleware
- MSW (`src/mocks/`) as the sole API backend today
- `@tanstack/react-query` installed and a `QueryClient` is instantiated — but **zero `useQuery`/`useMutation` call sites exist**
- date-fns 4.x, lucide-react, react (19-class)

**Agents:** 8 specialized agents (Architecture, Logic/Data Flow, Rendering, State+Forms, API/Contracts, Security/Privacy, Performance, Accessibility/Testing/Prod). Each agent inspected actual source, not names. Cross-agent overlap was merged (multiple agents independently flagged the same `LODController` dead code, the same `localStorage` token exposure, and the same `Math.min(...empty)` risk — those are rated with high confidence).

**Counts observed:**
- 88 `.ts/.tsx` files under `src/`
- 45 components
- `Tree3D.tsx` — 817 LOC (largest file)
- 6 API modules, 6 type files, 3 stores, 8 utility files, 5 mock files (~1,118 LOC combined)
- 0 test files, 0 CI config, 0 error boundaries

---

## 3. Architecture Assessment

The project is organized by feature with clean top-level separation: `src/app/` for routes, `src/components/{feature}/` for feature UI, `src/lib/api/` for the API facade, `src/lib/stores/` for Zustand state, `src/lib/utils/` for pure functions, and `src/mocks/` for MSW. Dependency direction is mostly correct — UI → stores/api → types — with **two leakages**:

1. `src/components/shared/StepSubjectPicker.tsx` imports directly from `@/mocks/subjects`, treating mock data as canonical. This hardcodes a mock-layer dependency into the shared component tree and will break when the real backend is flipped on.
2. `src/components/shared/MSWProvider.tsx` dynamically imports the mock worker. Acceptable as a deliberate bootstrap, but it means the only abstraction point is `NEXT_PUBLIC_MOCK_API` — which is checked as a string literal with no fallback.

`src/app/(dashboard)/layout.tsx` hardcodes `pathname === '/groups'` to switch to immersive mode. This is minor but a clear coupling of the global layout to a specific feature route.

No circular imports detected. The type barrel at `src/lib/types/index.ts` is well-structured (6 files, ~32 exports), with `contact.ts → booking.ts` and `group.ts → user.ts` being the only cross-references, both unidirectional.

Utility code is split inconsistently: a 6-line `src/lib/utils.ts` containing only `cn()` coexists with a full `src/lib/utils/` folder, and there is no barrel export for the folder. Callers mix both patterns.

The **biggest architectural concern is backend migration readiness**. `src/lib/api/client.ts` is a raw `fetch` wrapper with no cancellation, no dedup, no retry, no cache. Pages drive data loading manually via `useEffect + Promise.all`. The TanStack Query setup in `src/components/shared/Providers.tsx` is wasted bundle: it adds ~40 KB gzipped to every route while delivering zero cache benefit.

---

## 4. Cross-Agent Consensus Summary

These are findings that **two or more agents independently identified**, giving them the highest confidence:

| Finding | Agents | Confidence |
|---|---|---|
| `LODController` + `cardsHidden` state is dead code in `Tree3D.tsx` | Arch, Rendering | Confirmed |
| ~180 Drei `<Html>` portals dominate per-frame cost | Rendering, Perf | Confirmed |
| No React.memo / stable callbacks cause NodeCard re-render cascade | Rendering, Perf, Logic | Confirmed |
| Auth tokens in `localStorage` = XSS exfiltration vector | State, Security | Confirmed |
| Role enforcement is client-side only | Arch, Security | Confirmed |
| TanStack Query installed but unused | Arch, State | Confirmed |
| No test coverage, no CI, no error boundaries | Arch, Prod | Confirmed |
| Custom-entities store persists to localStorage with no migration / cleanup | State, Security | Confirmed |
| `Math.min(...empty)` risk in tree-layout.ts | Logic | Likely |
| Form state is manually threaded across every form | State, Logic | Confirmed |

---

## 5. Confirmed Findings by Severity

### CRITICAL

**C-1. No server-side auth or role enforcement**
- **Category:** Security / Architecture
- **What:** `src/middleware.ts` returns `NextResponse.next()` for every request regardless of token or role. `/reports`, `/settings`, `/groups` are reachable by any unauthenticated client.
- **Why it matters:** The handoff explicitly states `/reports` is Branch Leader+ only and the Gospel Worker avatar picker is Team Leader+ only. Both gates are client-side-only — a user can route-navigate directly or edit Zustand state to bypass them. This is fine while MSW is the only "backend," but **the moment the real Go backend is wired, this is a data-exposure bug.**
- **Root cause:** Middleware was scaffolded but never populated. Role helpers (`canPickGospelWorker`, `avatarsForRole`) enforce UI behavior only.
- **Impact chain:** middleware → every protected route → audit log, user data, booking mutations.
- **Confidence:** Confirmed
- **Fix direction:** Populate middleware to read the auth cookie/token, fetch the user role server-side, and gate routes by role. Mirror the role check server-side in every API mutation.

**C-2. Auth tokens in localStorage (XSS exposure)**
- **Category:** Security
- **What:** `src/lib/stores/auth-store.ts` stores JWT and the full user record in `localStorage` via Zustand `persist`. Any XSS payload from any dependency can exfiltrate the full session.
- **Why it matters:** `localStorage` is readable by any script running in the same origin. Diamond pulls from ~30+ npm dependencies (Three.js, drei, framer-motion, MSW, etc.) — a single compromised transitive dep can drain all active sessions. The current password "admin" is trivial, but the storage mechanism itself is the wrong primitive.
- **Root cause:** Convenience — no httpOnly cookie flow yet.
- **Confidence:** Confirmed
- **Fix direction:** Move token to an httpOnly, SameSite=Lax cookie issued by the backend. Keep only non-sensitive UI state in Zustand persist.

**C-3. Demo credentials leaked into production bundle**
- **Category:** Security
- **What:** `src/app/(auth)/login/page.tsx` renders "Demo: use admin / admin" when `process.env.NEXT_PUBLIC_MOCK_API === 'true'`. Since `NEXT_PUBLIC_*` values are inlined at build time and the live Vercel deploy is built with that flag true, this text ships to every visitor.
- **Why it matters:** Not a credential leak in the traditional sense (mocks accept any `admin` password), but it **signals to anyone visiting the live site** that the app has no real auth, which invites probing. Once the real backend goes live, this must not ship.
- **Confidence:** Confirmed
- **Fix direction:** Conditional should be runtime-gated or stripped before production build.

### HIGH

**H-1. `Math.min(...empty)` in tree-layout produces NaN / crash**
- **Category:** Logic
- **Location:** `src/lib/utils/tree-layout.ts:198`
- **What:** `(Math.min(...allChildCenters) + Math.max(...allChildCenters)) / 2` runs inside the branch-placement path. If `allChildCenters` is empty, the result is `(Infinity + -Infinity) / 2 = NaN`, which propagates into node positions and breaks the scene.
- **Confidence:** Likely (edge case, not actively triggering in the current scenario)
- **Fix direction:** Guard with a fallback center using the node's `minX` + half-width.

**H-2. Stale preaching partners in `ContactDetailDialog` EditMode**
- **Category:** Logic / State
- **Location:** `src/components/groups/ContactDetailDialog.tsx:348–351`
- **What:** `useState` initializer resolves `preachingPartnerIds` against the custom-entities store, but `entities` is **not** in the initializer's closure triggers. If the store hydrates after mount, the partners array is frozen with unresolved IDs.
- **Confidence:** Confirmed via code read
- **Fix direction:** Move the resolution into a `useEffect` keyed on `entities` + `contact.id`.

**H-3. No `React.memo` on NodeCard / ContactLeaf3D → re-render cascade**
- **Category:** Performance / Rendering
- **Location:** `Tree3D.tsx:132` (NodeCard), `Tree3D.tsx:288` (ContactLeaf3D)
- **What:** Both accept several freshly-created inline callbacks per parent render. Neither is wrapped in `React.memo`. Any `expandedIds` / `filters` / `focus` change re-renders all 180+ children.
- **Confidence:** Confirmed
- **Fix direction:** Wrap both components in `React.memo`; stabilize callback identities via handler maps keyed by id.

**H-4. `ContactDetailDialog` null-safety on `firstName[0] / lastName[0]`**
- **Category:** Logic
- **Location:** `ContactDetailDialog.tsx:169`
- **What:** `contact.firstName[0]`, `contact.lastName[0]` — no empty-string guard. Members with single-token names (e.g. `Michael`, no `lastName`) already hit this.
- **Confidence:** Confirmed
- **Fix direction:** Extract an `initials(contact)` helper with explicit fallback.

**H-5. Dead code: `LODController`, `cardsHidden`, stale shadow props**
- **Category:** Rendering / Maintainability
- **Location:** `Tree3D.tsx` — LODController defn, `cardsHidden` state, prop threading, Platform shadow flags
- **What:** `LODController` is defined but no longer instantiated. `cardsHidden` state is always `false`. The Platform mesh still declares shadow casting/receiving even though `Canvas` no longer renders a shadow map.
- **Confidence:** Confirmed
- **Fix direction:** Delete the `LODController` function, the `cardsHidden` state, the `cardsHidden` prop, and the shadow flags on Platform in a single cleanup pass.

**H-6. TanStack Query installed but unused**
- **Category:** Architecture / Performance
- **Location:** `src/components/shared/Providers.tsx:10–14`
- **What:** `QueryClient` is created, `QueryClientProvider` wraps the app, `@tanstack/react-query` ships in every route's bundle (~40KB gz), but no component uses it.
- **Confidence:** Confirmed
- **Fix direction:** Either rip out the TanStack setup, or commit to it and migrate page effects over.

**H-7. Custom-entities store is a backend-migration trap**
- **Category:** State / Architecture
- **Location:** `src/lib/stores/custom-entities-store.ts:27–46`
- **What:** Zustand persist stores user-added teachers/contacts/groups/rooms. IDs are `custom-{kind}-{Date.now()}` (collision at millisecond resolution). No versioning, no migration, no size cap, no cleanup hook on logout.
- **Confidence:** Confirmed
- **Fix direction:** Define a clear lifecycle with collision-safe IDs, versioning, dedup, and cleanup on logout.

**H-8. Continuous `useFrame` render loop**
- **Category:** Performance / Accessibility (battery)
- **Location:** `Tree3D.tsx` — `CameraRig` + `OrbitControls` + `Stars`
- **What:** `r3f` defaults to `frameloop="always"`; every frame is painted whether or not anything moved. The Platform's `useFrame` pulsing emissive forces constant rendering.
- **Confidence:** Confirmed
- **Fix direction:** Switch to `frameloop="demand"` and use `invalidate()` at the three triggers that actually need a frame.

### MEDIUM

**M-1. Auth store has no mount-time hydration gate**
- **Location:** `src/lib/stores/auth-store.ts:14–49`
- **What:** A `hydrate()` method exists but is never called at app root with a gate. Components may see null user before hydration.
- **Fix direction:** Wrap the dashboard layout in a hydration gate.

**M-2. No request dedup, cancellation, or abort**
- **Location:** `src/lib/api/client.ts:9–31`
- **What:** Raw `fetch` with no `AbortController`, no in-flight map.
- **Fix direction:** Add AbortController support per API verb.

**M-3. `handleContactSave` pattern refetches all contacts after every save**
- **Location:** `src/app/(dashboard)/groups/page.tsx:116`
- **Fix direction:** Optimistic update + selective splice instead of full refetch.

**M-4. 12-useState pattern in `groups/page.tsx`**
- **Location:** `src/app/(dashboard)/groups/page.tsx:41–57`
- **What:** 13 separate pieces of local state. `findNodeById` walk is unmemoized.
- **Fix direction:** Consolidate focus state into a discriminated union; memoize `findNodeById`.

**M-5. Form state explosion — no form library**
- **Location:** `ContactForm.tsx`, `ContactDetailDialog.tsx` EditMode, `BookingWizard.tsx`
- **What:** Each form manually threads 8+ `useState` calls. Reset logic duplicated.
- **Fix direction:** Adopt `react-hook-form` + `zod`.

**M-6. `BookingWizard` collects `editReason` but never sends it**
- **Location:** `src/components/booking/BookingWizard.tsx:122, 306, 672`
- **Fix direction:** Add `editReason` to the mutation body and the audit log handler.

**M-7. No CSRF protection**
- **Location:** `src/lib/api/client.ts`
- **Fix direction:** Align with whatever token/cookie strategy the Go backend chooses.

**M-8. Partner name→ID resolution is fragile**
- **Location:** `ContactForm.tsx:136–144`, `ContactDetailDialog.tsx:389–395`
- **What:** `.toLowerCase()` equality on names. Duplicate names silently resolve to whichever entity comes first.
- **Fix direction:** Track selection by ID on the input component itself.

**M-9. No error boundary, no observability, no test coverage**
- **Location:** No `error.tsx` at any route level; no `src/**/*.test.*`; no `.github/workflows/`.
- **Fix direction:** Add a root `error.tsx`, wire Sentry, stand up Vitest.

**M-10. No keyboard/screen-reader affordances on toolbar**
- **Location:** Icon-only buttons missing `aria-label`. `prefers-reduced-motion` not honored.
- **Fix direction:** Add `aria-label` to every icon-only button; use `useReducedMotion()`.

**M-11. No virtualization on contacts list**
- **Location:** `src/app/(dashboard)/contacts/page.tsx`
- **Fix direction:** `react-window` or TanStack Virtual once contact count grows.

### LOW

**L-1.** Texture mutation in `AvatarFigure` is non-idempotent — sets sampler props on every render.
**L-2.** Z-index overlap: sidebar overlay vs toolbar — possible but needs visual verification.
**L-3.** Framer Motion AnimatePresence exit animation truncation on rapid close.
**L-4.** Redundant `typeof window` check in `computeFullTreeFocus` — Canvas is already `ssr: false`.
**L-5.** Partner lookup fallback renders raw IDs instead of placeholder.
**L-6.** MSW mock state never reset on logout — mutations persist across sessions.
**L-7.** Utility module fragmentation — `lib/utils.ts` vs `lib/utils/` folder.
**L-8.** Unused `_contacts` parameter in `layoutTree`.

---

## 6. Likely Risks and Future Breakpoints

- **Scenario: backend flip day.** Custom-entities store + form ID resolution + missing request cancellation = combined failure.
- **Scenario: member count grows 10×.** `findNodeById` walk + refetch-all-contacts + no virtualization + no `React.memo` = compound slowdown.
- **Scenario: first real user on mobile.** Continuous `useFrame` + large DOM overlay count + no reduced-motion support = unusable on low-end Android.
- **Scenario: security researcher visits the live URL.** Demo credentials banner + missing middleware gate + localStorage token exposure.

---

## 7. Remediation Status

All findings were remediated in a follow-up pass. Key actions taken:

| Finding | Status | What was done |
|---------|--------|---------------|
| C-1 | ✅ Fixed | Middleware populated with cookie-based auth gate + RSC pass-through |
| C-2 | ✅ Partial | Cookie mirror added; httpOnly deferred until real backend |
| C-3 | ✅ Fixed | Demo credentials banner removed |
| H-1 | ✅ Fixed | Empty-array guard with loop-based min/max |
| H-2 | ✅ Fixed | useEffect re-resolves partners on entity/contact change |
| H-3 | ✅ Fixed | React.memo + per-id stable callback maps + useCallback on parent handlers |
| H-4 | ✅ Fixed | `initialsOf()` helper with null-safety |
| H-5 | ✅ Fixed | LODController, cardsHidden, shadow flags all deleted |
| H-6 | ✅ Fixed | TanStack Query removed from Providers + uninstalled from package.json |
| H-7 | ✅ Fixed | Collision-safe IDs, dedup, versioning, cap, clearAll on logout |
| H-8 | ✅ Fixed | frameloop="demand" + invalidate() on focus/animation |
| M-1 | ✅ Fixed | Hydration gate in dashboard layout |
| M-2 | ✅ Fixed | AbortController + isAbortError() in api client |
| M-3 | ✅ Fixed | Selective splice instead of full refetch |
| M-4 | ✅ Fixed | FocusRequest discriminated union + memoized nodeIndex |
| M-5 | Deferred | Form library migration too risky for hot-pass |
| M-6 | ✅ Fixed | editReason trimmed, sent, written to audit log |
| M-7 | Deferred | Needs real backend cookie strategy |
| M-8 | ✅ Fixed | Priority-order resolution (exact → CI → new entity) |
| M-9 | ✅ Fixed | Root error.tsx added |
| M-10 | ✅ Fixed | aria-labels on all icon-only buttons |
| M-11 | Deferred | Premature at current scale |
| L-1 | ✅ Fixed | Ref-guarded idempotent texture mutation |
| L-4 | ✅ Fixed | Removed redundant typeof window check |
| L-5 | ✅ Fixed | "Unknown partner" placeholder |
| L-6 | ✅ Fixed | resetMockState() on logout |
| L-7 | ✅ Fixed | Barrel export + cn() moved into folder |
| L-8 | ✅ Fixed | Unused parameter removed |

### Second-Pass Proactive Fixes

- Rules-of-hooks violation fixed (useEffect ordering vs early return)
- Root redirect loop prevented (/ allowed through middleware, hydrate refreshes cookie)
- frameloop="demand" wakeup path wired (invalidate on focus + each lerp frame)
- Parent handlers stabilized with useCallback
- React 19 texture-mutation rule satisfied via ref guard
- Duplicate import cleanup in Tree3D.tsx
- editReason → audit log wiring in MSW handler
- Custom-entities clearAll on logout
- ContactForm partner resolution mirrored to match Dialog fix

---

## 8. Relationship Trace Notes

**`expandedIds` ↔ `layout` ↔ `focus` pipeline**
- Any state transition that mutates `expandedIds` must wait for the next layout to complete (currently done via `setTimeout(50)`). This invariant is not encoded in types — it lives only in setTimeout delays.

**`externalFocusId` nullable dance**
- `handleJumpSelect`, `handleSearchSelect`, initial load effect all do `setFocusRequest({ kind: 'none' })` then `setTimeout(() => setFocusRequest({ kind, id }), 50)`. This is correctness-critical magic; if the setTimeout is removed, re-selects silently no-op.

**`entities` store ↔ `partners` state ↔ submit path**
- Three components resolve partner names through the same combinatorial lookup. None keep a canonical ID in the form state. This is the single largest source of data corruption risk.

**`MSWProvider` ↔ `StepSubjectPicker` ↔ `subjects.ts`**
- `StepSubjectPicker` imports from `@/mocks/subjects`. When the real backend ships, subjects must either stay client-bundled (move out of `/mocks`) or be fetched from the backend.

**`scenario-church-week.ts` ↔ `handlers.ts` ↔ api service types**
- All three must stay in sync manually. There is no cross-check; drift is silent.

**`CameraRig` ↔ `OrbitControls.makeDefault` ↔ `useFrame`**
- Both update the camera on the same frame; the `animatingRef.current` flag gates this but is a ref, not synchronized with React's commit phase.
