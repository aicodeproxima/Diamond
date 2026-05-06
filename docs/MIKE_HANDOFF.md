# Diamond — Backend Handoff for Mike

> **Status as of this writing:** Frontend Phases 0–7 are complete and live at
> `https://diamond-delta-eight.vercel.app` driven entirely by MSW mocks.
> Phase 8 = your backend cutover. Branch `feat/admin-system` is **local-only**
> on the frontend repo right now (16 commits ahead of `main`); we'll push it
> the moment your auto-scanner can absorb the new shape without clobbering
> your WIP. **Don't fetch the branch yet** — heads-up first.
>
> This doc is your one-stop reference. Treat it as the contract. If anything
> below disagrees with what you find in `src/lib/api/*.ts` or
> `src/mocks/handlers.ts`, the source files win — they're what the live
> frontend actually calls.

---

## TL;DR — five things to do

1. **Stand up the endpoints listed in [§4 Endpoint inventory](#4-endpoint-inventory).** All 40+ routes are already exercised by the live frontend; MSW handlers in `src/mocks/handlers.ts` are your reference implementation.
2. **Mirror the audit-log expansion** ([§6](#6-audit-log--append-only-required)). The schema grew 9 new entity types and 9 new action verbs in this overhaul. The frontend filters on the new union members; if you don't emit them, the Reports + Audit Log tabs go quiet.
3. **Adopt the typed error envelopes** ([§7](#7-error-envelopes)). Frontend now branches on `code` (`PERMISSION_DENIED` / `BLOCKED_SLOT_CONFLICT` / `USERNAME_TAKEN` / etc.) — string-match on `message` is gone. 409s in particular need a `details.slot` payload for the booking wizard.
4. **Re-run every permission rule server-side** ([§5](#5-permissions--server-side-must-match-the-frontend-helpers)). Frontend gates are UX only; your middleware is the only thing standing between a Member and the audit log when the fetch flag flips.
5. **Cut the auth pivot** ([§9](#9-auth-migration--localstorage--httponly)). Move tokens to `Set-Cookie httpOnly SameSite=Lax`. The frontend has a temporary localStorage→cookie mirror today; remove that on cutover.

---

## 1. What changed since you last looked

If your last contact was around the time the app was a single-area, single-Topbar
calendar booker, here's what's now in front of you:

| Area | Before | After |
|---|---|---|
| **Org structure** | Single area "Main Church", 4 branch leaders (Sarah / James / Rachel / Daniel), David Park as Overseer | 5 Zion branches (Newport News / Chesapeake / Norfolk / Virginia Beach / Williamsburg). Male biblical Branch Leaders (Joseph / Zechariah / John the Baptist / Simeon / Simon Peter). Gabriel as Overseer. Michael + Stephen Wright as Devs. **132 total users.** |
| **"Teacher" role** | A real role in the hierarchy | Removed as a role. Now a **tag** on User records (`tags: string[]`). All Group + Team Leaders + ~20 Members carry it. Required to be assigned as a Bible-study leader. Two more seeded tags: `co_group_leader` (10 users) and `co_team_leader` (15 users). |
| **Blocked time slots** | Didn't exist | First-class entity. 4 default global slots (Tuesday 20:00–21:00, Sat 9–10/15–16/20–21). Bookings overlapping a blocked slot must be **rejected with 409**, regardless of role. Branch Leader+ may CRUD them. |
| **Admin surface** | Didn't exist | Full `/admin` page with 9 tabs: Users, Groups, Rooms & Areas, Blocked Slots, Contacts, Audit Log, Tags, Permissions (read-only matrix), System Config (Dev-only). Each tab is gated by `canSeeAdminTab`. |
| **Audit log** | Sparse, 5 action verbs + 5 entity types | Expanded to 14 actions × 14 entity types + `before` / `after` / `reason` fields. **Append-only** — no UI hard-deletes. |
| **Forced first-login password change** | Didn't exist | New `mustChangePassword: boolean` flag on User. Set on user create + admin reset. Dashboard layout redirects to `/first-login` when true; user is locked out of the app until they pick a password. |
| **Soft-delete uniformity** | Mix | Universal — every UI delete is now `isActive: false`. The DELETE `/bookings/:id` endpoint was converted to a soft-cancel. |

Most of the schema changes are additive (new fields, new union members);
everything still rendered correctly against the older mock backend during
the audit. The behavior changes (409 enforcement, stricter audit fields)
are where you'll do the real work.

---

## 2. Repository layout & deploy

- **Frontend repo:** `https://github.com/aicodeproxima/Diamond`
- **Active branch:** `feat/admin-system` (local-only on the frontend right now — see top of this doc)
- **Live URL:** `https://diamond-delta-eight.vercel.app`
- **Frontend deploy:** Vercel CLI (`npx vercel --prod --yes`) — uploads working dir directly, no git push required. The frontend has been deployed at `feat/admin-system` HEAD without ever pushing the branch.
- **Frontend local dir:** `C:\Users\aicod\Diamond` (Windows). Bash uses `/c/Users/aicod/Diamond`.

The backend is your Go codebase, separate from this repo. The frontend reaches you via:

```
NEXT_PUBLIC_API_URL=<your-backend-base-url>     # e.g. https://api.diamond.example.com
NEXT_PUBLIC_MOCK_API=false                        # flips MSW off
```

Both currently live in Vercel project env vars. Today they're set to
`/api` + `true` so MSW intercepts. Cutover = flip both.

---

## 3. Wire format basics

- **Content-Type:** `application/json` in and out.
- **Auth header (today):** `Authorization: Bearer <jwt>`. Token lives in the frontend's `localStorage` AND mirrors into a `diamond-session` cookie so middleware can read it. **§9 lays out the migration to httpOnly.**
- **Soft-delete only.** Universal rule from `docs/PERMISSIONS.md`. No UI offers a hard-delete; your endpoints should refuse to honor one even if a payload tries.
- **Audit attribution:** every state-changing call includes `actorId` (or `createdById` on user create) somewhere in the request — body for POST/PUT, query string isn't used. Read it for audit-row attribution. Once cookies carry the JWT, derive actor from the JWT instead.
- **Optimistic IDs not used.** Frontend never generates IDs — server allocates.
- **Timestamps:** ISO 8601 strings (`new Date().toISOString()` shape). UTC.
- **Pagination shape:** envelope `{ entries: T[], total: number, page: number, limit: number }`. Currently only the audit-log endpoint paginates; default page size is 25.

---

## 4. Endpoint inventory

Every endpoint the frontend calls today, with the source file in `src/lib/api/*` that calls it. **Verb + path is the contract.** Reference implementation in `src/mocks/handlers.ts`.

### 4.1 Auth + session
| Verb | Path | Notes |
|---|---|---|
| POST | `/login` | Body: `{ username, password }`. 200 → `{ token, user }`. 401 on bad creds. **Must emit** `login_success` audit row on 200 (entityType=`login_success`, action=`login`, entityId=user.id) and `login_failed` on 401 (entityId=attempted username). |
| GET | `/me` | Bearer → 200 `User` \| 401. |

Deferred (no caller yet): `POST /logout`, `POST /refresh`. Add when you're ready for token refresh.

### 4.2 Users
| Verb | Path | Notes |
|---|---|---|
| GET | `/users` | 200 `User[]`. **Server-side scope filter per matrix:** Member → self only; Team/Group L → subtree; Branch L+ → all. The frontend builds a `VisibilityScope` from the response (`buildVisibilityScope(viewer, allUsers)`) for downstream client-side filtering, but your server is the security gate. |
| POST | `/users` | Body: `CreateUserPayload` (see §5 / [src/lib/api/users.ts:4-16](../src/lib/api/users.ts)). Returns 201 `User` \| 400 \| 409 \| 403. **Username regex:** `/^[a-z0-9_.-]{3,32}$/`. Case-insensitive uniqueness on both username AND email. Server MUST recompute `canCreateUser(viewer, targetRole)` AND validate `targetParentId` is in viewer's subtree (Team/Group L only — Branch L+ is exempt). **mustChangePassword=true on create.** Auto-assign `'teacher'` tag when role is `branch_leader`/`group_leader`/`team_leader` AND caller didn't explicitly pass `tags` (caller's `tags` always wins; explicit `[]` opts out). Audit: `user.create` row with `after: { role, parentId, groupId }`. |
| PUT | `/users/:id` | Partial update of name / email / phone / role / parentId / groupId / avatarUrl. **Reject** `username`, `id`, `createdAt`, `isActive`, `mustChangePassword` in the body — those have dedicated endpoints. Recompute `canEditUser` AND `canChangeRole` if role changes. Diff before/after; emit `role_change` (entityType=`role_change`) on role diff, `group_assignment` (entityType=`group_assignment`) on parent/group diff, plus a generic `user.update` row. |
| POST | `/users/:id/deactivate` | Body: `{ actorId }`. Sets `isActive=false`. Audit: `user.delete` (verb intentional — entityType disambiguates) with `before/after = { isActive }`. |
| POST | `/users/:id/restore` | Body: `{ actorId }`. Audit: `user.restore`. |
| POST | `/users/:id/reset-password` | Body: `{ actorId }`. **Returns** `{ tempPassword: string, user: User }`. Generate a one-time temp password, set `mustChangePassword=true`, **never log the temp password**, audit row uses entityType=`password_reset` action=`reset_password`. The frontend shows the tempPassword to the resetter ONCE and forces the target through `/first-login` on next login. |
| POST | `/users/:id/change-password` | **NEW for Phase 6.** Body: `{ newPassword: string }`. Caller is the user themselves (token holder). 400 if `newPassword.length < 6`. Clears `mustChangePassword`. Audit row: entityType=`password_reset`, action=`update`, actorId = the user themselves. |
| PUT | `/users/:id/tags` | Body: `{ tags: string[], actorId }`. Recompute `canManageTags`. **Audit:** emit ONE row per added tag (`tag_grant`) and ONE per removed (`tag_revoke`); each entityType=`tag`, entityId=the tag id. Don't emit a single bulk-replace row — frontend's audit detail dialog expects per-tag rows. |
| PUT | `/users/:id/username` | Body: `{ username: string, actorId }`. 400 if regex fails. 409 if taken (case-insensitive). Recompute `canChangeUsername` (Overseer+ for others; anyone for self). Audit: entityType=`username_change`, action=`rename`, before/after = `{ username }`. |

Missing on the MSW side but you should consider implementing: `GET /users/:id` for single-user fetch, `GET /audit-log/:id` for the detail drawer.

### 4.3 Areas + rooms
| Verb | Path | Notes |
|---|---|---|
| GET | `/areas` | Default returns active areas with active rooms only. `?includeInactive=1` returns everything (used by the admin RoomsTab restore flow). |
| POST | `/areas` | `{ name, description? }` → 201 `Area`. |
| PUT | `/areas/:id` | `{ name?, description?, isActive? }`. |
| POST | `/areas/:id/deactivate` / `/restore` | |
| POST | `/areas/:areaId/rooms` | `{ name, capacity?, features? }` → 201 `Room` \| 409 `ROOM_NAME_TAKEN`. Uniqueness within the area, case-insensitive, active rooms only. |
| PUT | `/rooms/:id` | `{ name?, capacity?, features?, isActive?, isBookable? }`. |
| POST | `/rooms/:id/deactivate` / `/restore` | |

**New on Room: `isBookable?: boolean`** (defaults to true). When false, the room exists in the picker's catalog for completeness but the BookingWizard filters it out. Used for Newport News Sanctuary + Fellowship — service-only spaces that should never accept Bible studies.

### 4.4 Blocked slots
| Verb | Path | Notes |
|---|---|---|
| GET | `/blocked-slots` | Returns active globals + (if `?areaId` given) that area's slots. |
| POST | `/blocked-slots` | Body: `BlockedSlot` shape minus `id`/`createdAt` plus `actorId`. Recompute `canManageBlockedSlot` (Branch L+). **Validate** `reason` non-empty, `scope ∈ {global, area}`, `recurrence ∈ {weekly, one-off}`. Audit: entityType=`blocked_slot` action=`create`. |
| PUT | `/blocked-slots/:id` | Audit: `blocked_slot.update` with before/after. |
| DELETE | `/blocked-slots/:id` | **Soft-delete via `isActive=false`** — historical bookings still need to know what blocked them. Body carries `{ actorId }`. Audit: `blocked_slot.delete`. |

### 4.5 Bookings
| Verb | Path | Notes |
|---|---|---|
| GET | `/bookings` | `?start&end&areaId&roomId`. |
| GET | `/bookings/:id` | |
| POST | `/bookings` | **MUST 409** with `code: 'BLOCKED_SLOT_CONFLICT'` and `details.slot = <BlockedSlot>` if the booking's `(areaId, startTime, endTime)` overlaps any active blocked slot. The matrix line "no role overrides" is non-negotiable. The exact overlap math is in `src/lib/utils/availability.ts:findOverlappingBlockedSlot` — copy that. **Side-effect:** when `activity === 'bible_study'` and `contactId` is set, bump that contact's `totalSessions++`, `currentlyStudying = true`, `lastSessionDate = body.startTime`. Mirror on cancel. |
| PUT | `/bookings/:id` | Same 409 contract as POST when the edit moves into a blocked window. `editReason` (optional string) is recorded as the audit-row `reason` field. |
| POST | `/bookings/:id/cancel` | `{ reason: string, actorId }`. Soft-cancel; sets `status='cancelled'`, `cancelReason`, `cancelledBy`, `cancelledAt`. Audit: `booking.cancel`. |
| POST | `/bookings/:id/restore` | Un-cancels. Audit: `booking.restore`. |
| DELETE | `/bookings/:id` | **Deprecated path** — frontend no longer calls this. If you implement it, make it a soft-cancel mirror (don't hard-delete) so audit history survives. Or reject with 405. |

### 4.6 Contacts
| Verb | Path | Notes |
|---|---|---|
| GET | `/contacts` | `?search&type&stage&sort&sortDir`. Server-side scope filter per matrix. |
| GET | `/contacts/:id` | |
| POST | `/contacts` | |
| PUT | `/contacts/:id` | |
| DELETE | `/contacts/:id` | Soft-delete only. |
| POST | `/contacts/:id/convert` | **NEW for Phase 5/CONT-5.** Body: `{ role: UserRole, parentId?: string, groupId?: string, actorId? }`. Returns `{ user: User, contact: Contact }`. Atomic: if username generation collides too many times, **don't mutate the contact**. Generate username from first.last (lowercased, regex-sanitized) with numeric suffix on collision. Set `Contact.convertedToUserId = newUser.id` AND `Contact.status = 'converted'` (string). Emit TWO audit rows under one timestamp: `user.create` (from the new account) AND `contact.update` with `before.status` / `after.status`. New user gets `mustChangePassword: true`. |

### 4.7 Org + metrics + audit
| Verb | Path | Notes |
|---|---|---|
| GET | `/groups` | Probably overlaps `/users` — frontend uses both; align them however makes sense. |
| GET | `/groups/tree` | Pre-assembled `OrgNode[]`. |
| GET | `/metrics/teachers` | `?userId` optional. Returns `TeacherMetrics[]` per `src/lib/types/user.ts:110-118`. |
| GET | `/audit-log` | `?page&limit&action&entityType&userId&search&startDate&endDate&branchId`. Returns the envelope `{ entries, total, page, limit }`. Branch Leaders pass `branchId=viewer.branchId`; you filter entries whose entity resolves into that branch's subtree. **Append-only — no POST/PUT/DELETE on this resource.** |

A friendly note: the frontend's `groupsApi.getAuditLog` currently accepts BOTH a bare-array and the envelope shape (legacy compat). Lock to the envelope and we'll drop the fallback after cutover.

---

## 5. Permissions — server-side must match the frontend helpers

The single source of truth lives in [`docs/PERMISSIONS.md`](./PERMISSIONS.md). The
frontend implementation that matches it lives in
[`src/lib/utils/permissions.ts`](../src/lib/utils/permissions.ts) — 32 pure
functions, all unit-tested (108 tests in `permissions.test.ts` + `availability.test.ts`).

**Your job:** re-run the same checks server-side. Pure-function porting is
straightforward — every helper takes `(viewer, target?, ...)` and returns
boolean. No DOM, no store, no network access.

The minimum viable middleware contract:

1. Verify the JWT and resolve `viewer = User`.
2. For `/admin/*` requests, call `canSeeAdminPage(viewer)` and 403 if false.
3. For `/reports/*` requests, call `canAccessReports(viewer)` and 403 if false.
4. For every mutation endpoint, re-run the per-resource helper with the request body and 403 if false. Some examples:
   - `POST /users` → `canCreateUser(viewer, body.role, body.parentId, subtreeUserIds)`
   - `PUT /users/:id` (with role change) → `canChangeRole(viewer, target, body.role)`
   - `POST /bookings` → `canEditBooking(viewer, booking)` plus the blocked-slot check
   - `PUT /users/:id/username` → `canChangeUsername(viewer, target)` (Overseer cannot rename peer Overseer — only Devs can)
5. For list endpoints, apply the scope filter from `scopeForRole(viewer)` server-side. The frontend can't be trusted to filter for security purposes once your auth is real.

**Universal rules** (every helper bakes these in — re-state them in your guards):

- **Cross-branch is allowed.** Leader-tier (Team Leader+) can act on records in any branch.
- **Peer-edit at leader tier is allowed.** Branch Leader can edit Branch Leader. Members and Teacher-tagged Members CANNOT edit other Members.
- **Cannot modify above own level.** Universal — no exceptions. Even Devs can only be edited by Devs.
- **Cannot grant a role at-or-above own level.** Only Devs grant Dev. Overseers grant up to Branch Leader.
- **Soft-delete only.** Universal. No hard-delete from any UI.
- **Members and Teacher-tagged users have identical permissions.** Teacher is a capability tag (eligibility to lead Bible studies), not a privilege tag.

**Quirks worth calling out:**

- `canChangeUsername(viewer, target)`: Overseer+ for others, AND target must not be at-or-above Overseer unless viewer is Dev (only Devs rename Overseers).
- `canResetPassword(viewer, target)`: returns false for self. Self password change goes through `/users/:id/change-password` gated by `canChangeOwnPassword` (universally true for any authenticated user).
- `canManageTagDefinitions(viewer)`: Overseer+. Branch Leaders see the Tags tab as **view-only**; the matrix says they don't have edit affordance there.
- `canEditUserField(viewer, target, field)`: gates SAFE_SELF_FIELDS (firstName / lastName / phone / email / avatarUrl) for self. For others, mirrors `canEditUser`. Used to keep self-edit honest — no payload that includes role/tags/parent/username should slip through this on a self-target.

---

## 6. Audit log — append-only required

### 6.1 Schema (current)
```ts
interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  userId: string;        // actor
  userName: string;      // denormalized for fast UI render
  details: string;       // human-readable summary
  before?: unknown;      // pre-mutation snapshot (JSON-serializable)
  after?: unknown;       // post-mutation snapshot
  reason?: string;       // actor-supplied reason (booking edits, etc.)
  timestamp: string;     // ISO 8601
}
```

### 6.2 Action verbs (14)
```
create, update, delete, cancel, restore, export,
login, login_failed, reset_password, rename,
tag_grant, tag_revoke, role_change, reassign
```

### 6.3 Entity types (14)
```
booking, contact, user, group, report,
tag, permission, blocked_slot,
password_reset, username_change,
login_success, login_failed,
role_change, group_assignment
```

### 6.4 Rules

- **Append-only.** No PUT, no DELETE on audit rows from any UI. Defense-in-depth from your side: even if a privileged token reaches an `/audit-log/:id` PATCH, refuse it.
- **`before`/`after` should snapshot only the changed fields**, not the whole entity. Saves storage, simplifies the detail-drawer rendering. Frontend already renders these as JSON code blocks if present.
- **Login attribution:** on `login_success`, actor = the user who logged in. On `login_failed`, actor = `'anonymous'` and `userName = attempted_username` (we still want to render the attempted name in the trail).
- **Tag mutations:** one row per add or remove. Don't bulk-replace.
- **Role + parent changes** during a `PUT /users/:id` should emit two paired rows (`role_change` + `group_assignment`) plus the generic `user.update` for safe fields. The detail drawer relies on this for compliance review.
- **Reset password:** the audit row records that a reset happened. **Never persist the temp password value in the row.** The temp password is delivered once in the HTTP response and that's the only time it leaves the server.

---

## 7. Error envelopes

Frontend's `src/lib/api/client.ts` throws a typed `ApiError` for non-2xx responses with `status`, `code`, `message`, `details`. Your bodies should be:

### 7.1 401 — generic
```json
{ "message": "Invalid credentials" }
```
No code needed. Frontend uses 401 to wipe the token + bounce to `/login` regardless of code.

### 7.2 403 — permission denied
```json
{
  "code": "PERMISSION_DENIED",
  "message": "Branch Leader required",
  "details": { "required": "branch_leader" }
}
```

### 7.3 409 — conflict
```json
{
  "code": "BLOCKED_SLOT_CONFLICT",
  "message": "Overlaps Tuesday service",
  "details": { "type": "blocked_slot", "slot": <BlockedSlot> }
}
```
Other 409 codes:
- `USERNAME_TAKEN`, `EMAIL_TAKEN`, `ROOM_NAME_TAKEN` — same shape minus `details.slot`. `message` should be human-friendly; the frontend toasts it.

### 7.4 400 — validation
```json
{
  "code": "VALIDATION_ERROR",
  "message": "Username must be 3-32 chars: a-z, 0-9, dot, dash, underscore"
}
```
Or for the username regex specifically: `code: 'INVALID_USERNAME'`.

### 7.5 404
```json
{ "code": "NOT_FOUND", "message": "Booking not found" }
```

### 7.6 The full code union
Frontend treats unknown codes as `'UNKNOWN'`. You can extend the union — just send what makes sense; the frontend won't crash on extras, it just won't pattern-match them.

---

## 8. Mock data shape (for quick local testing)

If you want to seed your dev DB with the exact same shape the frontend has been
testing against, the canonical seed lives in
[`src/mocks/scenario-church-week.ts`](../src/mocks/scenario-church-week.ts). It's
deterministic — same PRNG seed every run.

Headline numbers:

- 132 users (2 Devs / 1 Overseer / 5 Branch Leaders / 10 Group Leaders / 15 Team Leaders / 99 Members)
- 5 areas (Newport News Zion / Chesapeake Zion / Norfolk Zion / Virginia Beach Zion / Williamsburg Zion)
- ~26 rooms across the 5 areas
- 50 contacts in various pipeline stages
- 4 default global blocked slots (Tue 20-21, Sat 9-10, 15-16, 20-21)
- ~70 bookings for the current calendar week, deterministic
- The user IDs follow `u-<seed-name>` — `u-michael`, `u-overseer`, `u-branch-1`...`u-branch-5`, `u-group-1`...`u-group-10`, `u-team-1`...`u-team-15`, `u-mem-1`...`u-mem-99`.

Test credentials (all): password `'admin'`. Useful logins:
```
admin     → Michael (Dev)
stephen   → Stephen Wright (Dev)
overseer1 → Gabriel
branch1   → Joseph
group1    → first group leader
team1     → first team leader
member1   → first member
```

---

## 9. Auth migration — localStorage → httpOnly

### 9.1 Today
- Frontend POSTs `/login`, gets `{ token, user }`.
- Token + user record persist to `localStorage` (Zustand `persist`).
- Token also writes to a non-httpOnly `diamond-session` cookie (so middleware can observe it).
- Middleware (`src/middleware.ts`) just checks cookie presence — there's no server-side role enforcement on routes today (that's audit C-1).

### 9.2 Target on cutover
1. Backend issues `Set-Cookie: diamond-session=<jwt>; HttpOnly; SameSite=Lax; Secure; Path=/` on `POST /login`.
2. Frontend stops persisting tokens to localStorage entirely. `auth-store` keeps only the User record (for fast UI render). I'll cut the localStorage write in the same PR that removes the cookie mirror.
3. Middleware (`src/middleware.ts`) reads the cookie, verifies the JWT signature server-side, sets `request.headers['x-diamond-user']` for downstream handlers (or whatever pattern Next.js 16 prefers), and 403s on `/admin/*` + `/reports/*` for sub-Branch-Leader.
4. CSRF: pick a strategy. Double-submit token is least-invasive; SameSite=Lax already mitigates the obvious cases. Either way I'll add the right header / cookie pair on the frontend once you tell me which.

### 9.3 Sequencing
- Don't flip `MOCK_API=false` until your `/login` issues the httpOnly cookie. Flipping early breaks the auth observer in middleware.
- Once flipped, any pre-existing localStorage tokens in users' browsers become invalid silently — the next protected fetch will 401, which the frontend handles by wiping the local state and redirecting to `/login`. So the upgrade is graceful, no manual logout needed.

---

## 10. Cutover checklist

1. **You confirm to me** when your backend is ready for the new shape and your auto-scanner can absorb the `feat/admin-system` push. Right now I'm holding on it.
2. **I push `feat/admin-system` to `main`** (or whatever target you specify) on the frontend repo.
3. **You verify** your scanner picked up the new types in `src/lib/types/*.ts` cleanly — particularly the expanded `AuditLogEntry` union, the new `Room.isBookable`, the new `Contact.status: 'converted'` value, the `User.mustChangePassword` flag.
4. **You stand up the new endpoints** (CONT-5 convert, Phase-6 change-password, anything missing in §4).
5. **We swap Vercel env vars** in lock-step:
   - `NEXT_PUBLIC_API_URL` → your backend base URL
   - `NEXT_PUBLIC_MOCK_API` → `false`
6. **Smoke tests on the live URL** (I'll run via Playwright):
   - Login flow (login_success row appears in audit log)
   - Bad-creds login (login_failed row appears)
   - Create user as Dev → user shows in `/admin?tab=users`, audit row exists
   - Reset that user's password → tempPassword returned, mustChangePassword=true
   - Login as that user → bounced to `/first-login`, dashboard locked
   - Set new password → redirected to `/dashboard`, can navigate
   - Try to book a Sat 9am Bible study → 409 with `code:'BLOCKED_SLOT_CONFLICT'`
   - Convert a contact to user → paired audit rows + user appears in admin
   - Branch Leader sees branch-scoped audit log; Overseer sees global
   - Member cannot reach `/admin` or `/reports` (server 403)
7. **Rollback plan:** flip `NEXT_PUBLIC_MOCK_API=true` on Vercel and trigger a redeploy. MSW takes over and the frontend operates standalone again. We can iterate on backend issues without holding up demos.

---

## 11. Open questions for you

1. **Username collision handling on contact-convert.** I generate `first.last` lowercase + numeric suffix on collision. Acceptable? Anything you'd prefer (e.g. honor a preferred-username field on the Contact)?
2. **Audit-log retention.** No retention policy in the frontend — the server should make that call. 90 days? Indefinite? Tiered (raw 90d, summary forever)?
3. **Tag definition catalog.** Today the frontend infers the tag catalog from `KNOWN_TAGS` constant + observed user.tags strings. The Tags tab's "Define Tag" button just shows a toast — there's no separate `tag_definitions` table on the frontend. If you want a real one server-side, share the schema and I'll wire CRUD.
4. **Editing history on bookings.** `Booking.editReason` is single-shot (overwritten each edit). The audit log carries the full edit history. Confirm this is the source of truth, or tell me you'd rather have an `editHistory: { reason, editedBy, editedAt }[]` on the booking row.
5. **`/me` body shape on cookie auth.** With the JWT only in the cookie, the frontend can't decode it client-side. Should `/me` carry the full User on every navigation, or do we accept a one-time fetch + Zustand cache?
6. **CSRF strategy.** Double-submit token? Origin header check? SameSite=Strict (more disruptive)? Whatever you pick, give me the name of the header you want on POST/PUT/DELETE.
7. **Rate limiting.** Login + reset-password are the obvious abuse surfaces. Any prefs on lockout windows / brute-force handling? I can plumb retry-after handling on the frontend if you set 429s.

---

## 12. Reference files in this repo

| File | What it is |
|---|---|
| `docs/PERMISSIONS.md` | Source of truth for the matrix. Cell-for-cell mapping to helpers in `permissions.ts`. |
| `docs/BACKEND_GAPS.md` | Earlier draft of this doc — slightly less polished, machine-generated during the audit. Same intent. |
| `src/lib/utils/permissions.ts` | All 32 permission helpers, pure functions. Port these to Go. |
| `src/lib/utils/permissions.test.ts` | 70 + tests pinning every cell of the matrix. Useful as a verification corpus. |
| `src/lib/utils/availability.ts` | `findOverlappingBlockedSlot` — the exact overlap math you need to mirror. |
| `src/lib/utils/availability.test.ts` | 14 tests covering weekly slots, partial overlaps, exact-touch, area scoping, one-off date-range, malformed slots. |
| `src/lib/api/*.ts` | Every fetch the frontend makes — your endpoint list. |
| `src/lib/types/*.ts` | Wire-format types (User, Contact, Booking, BlockedSlot, Group, AuditLogEntry, etc). |
| `src/mocks/handlers.ts` | Reference implementation for every endpoint. ~700 lines. Steal liberally. |
| `src/mocks/scenario-church-week.ts` | Deterministic seed for 132 users / 50 contacts / 4 blocked slots / 70 weekly bookings. |
| `MOCK_SCENARIO.md` | Human-friendly walkthrough of the seed. |
| `HANDOFF.md` | Older agent-handoff doc. Some stale parts (pre-Phase-2). The Vercel + git sections are still accurate. |

---

## 13. How to reach the frontend

- **Branch I'm holding:** `feat/admin-system` @ `b8a0d34` (latest at time of writing). Sixteen commits, surgical and reasonably squashable if you want a tidy history before push.
- **Live preview right now (mock-mode, your reference):** https://diamond-delta-eight.vercel.app
- **Tests:** `npm test` — 108 / 108 currently pass.
- **Build:** `npm run build` — clean.

When you're ready to begin integration, tell me which env-var swap you want first, and whether to push the branch as-is or squash. I can have the frontend pointed at your backend within an hour of confirmation.

— frontend
