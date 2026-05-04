/**
 * Diamond — permission utilities.
 *
 * SOURCE OF TRUTH: docs/PERMISSIONS.md. If a helper here disagrees with that
 * doc, fix the helper — the doc wins. Every helper is a pure function of
 * (viewer, target?) so it can be unit-tested without DOM, store, or network.
 *
 * Two cross-cutting rules baked into nearly every helper:
 *   1. CROSS-BRANCH — leaders (Team Leader and above) can act on records in
 *      ANY branch, not just their own. Branches actively share caretaking.
 *   2. PEER-EDIT — leaders can edit other users at the SAME role level.
 *      A Branch Leader can edit another Branch Leader. The universal "cannot
 *      modify ABOVE your own level" rule still applies, so a Branch Leader
 *      can never edit an Overseer or a Dev.
 *
 * "deny by default" — when a rule is unclear or a required field is missing,
 * helpers return `false`. Forgetting a check fails closed, not open.
 */

import { ROLE_HIERARCHY, UserRole, type User } from '../types';
import type { BlockedSlot, Booking, Contact } from '../types';

// =============================================================================
// Hierarchy primitives
// =============================================================================

/** Role rank. Higher = more authority. Member=0, Dev=5. Unknown roles → -1. */
export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

/** True if the viewer can act on records in any branch (Team Leader+). */
export function isLeader(viewer: User | undefined | null): boolean {
  if (!viewer) return false;
  return getRoleLevel(viewer.role) >= getRoleLevel(UserRole.TEAM_LEADER);
}

/** True if the viewer is on or above the admin tier (Branch Leader+). */
export function isAdminTier(viewer: User | undefined | null): boolean {
  if (!viewer) return false;
  return getRoleLevel(viewer.role) >= getRoleLevel(UserRole.BRANCH_LEADER);
}

/**
 * Returns the roles a creator may assign when adding a new user.
 *   - Devs may create any role including another Dev.
 *   - Anyone else can create roles strictly BELOW their own level.
 */
export function assignableRoles(creatorRole: UserRole): UserRole[] {
  const max = getRoleLevel(creatorRole);
  if (creatorRole === UserRole.DEV) return [...ROLE_HIERARCHY];
  return ROLE_HIERARCHY.slice(0, max);
}

// =============================================================================
// Users
// =============================================================================

/**
 * canViewUser — see docs/PERMISSIONS.md → Users → "View other users"
 *
 * - Self: always allowed.
 * - Members: cannot view other users.
 * - Team Leader and above: can view ALL users (read-all per matrix).
 */
export function canViewUser(viewer: User, target: User): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return true;
  return isLeader(viewer);
}

/**
 * canEditUser — see docs/PERMISSIONS.md → Users → "Edit role / parent / status of others"
 *
 * Members cannot edit other Members (no peer-edit at the bottom tier).
 * Otherwise: viewer.level >= target.level (peer-edit allowed at leader tier),
 * and only Devs can edit Devs.
 */
export function canEditUser(viewer: User, target: User): boolean {
  if (!viewer || !target) return false;
  // Self-edit of safe fields (display name, phone, email, password, theme)
  // is always allowed — caller decides which fields are "safe."
  if (viewer.id === target.id) return true;
  // Universal: cannot edit ABOVE your own level.
  if (getRoleLevel(target.role) > getRoleLevel(viewer.role)) return false;
  // Universal: only Devs may edit Devs (no peer-edit between Devs from a
  // non-Dev — already covered by the above check, but re-stated for clarity).
  if (target.role === UserRole.DEV && viewer.role !== UserRole.DEV) return false;
  // Members cannot edit other Members (peer-edit is leader-tier only).
  if (viewer.role === UserRole.MEMBER) return false;
  return true;
}

/**
 * canChangeRole — assigning a role to a target user.
 *
 * Combines canEditUser with the "cannot grant a role at-or-above your own
 * level" rule (Devs are the exception — they can grant Dev).
 */
export function canChangeRole(viewer: User, target: User, newRole: UserRole): boolean {
  if (!canEditUser(viewer, target)) return false;
  if (viewer.role === UserRole.DEV) return true;
  return getRoleLevel(newRole) < getRoleLevel(viewer.role);
}

/**
 * canDeactivateUser — soft-delete (sets isActive=false).
 *
 * Same as canEditUser but explicitly forbids self-deactivation (no one can
 * lock themselves out via the UI).
 */
export function canDeactivateUser(viewer: User, target: User): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return false;
  return canEditUser(viewer, target);
}

/**
 * canResetPassword — admin-initiated password reset. Same scope as edit
 * (Members cannot, leaders can manage anyone below them, peer-edit at tier).
 * Self password change goes through a separate flow that's always allowed.
 */
export function canResetPassword(viewer: User, target: User): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return true;  // self-change always allowed
  return canEditUser(viewer, target);
}

/**
 * canCreateUser — combines (a) "leader-tier required" with (b) "cannot grant
 * a role at-or-above your own level".
 */
export function canCreateUser(viewer: User, targetRole: UserRole): boolean {
  if (!isLeader(viewer)) return false;
  if (viewer.role === UserRole.DEV) return true;
  return getRoleLevel(targetRole) < getRoleLevel(viewer.role);
}

/** Anyone Team Leader+ can create users (compat with prior callers). */
export function canCreateUsers(role: UserRole): boolean {
  return getRoleLevel(role) >= getRoleLevel(UserRole.TEAM_LEADER);
}

/**
 * canManageTags — add/remove tags on a target. Mirrors canEditUser.
 *
 * Self-tag-management is NOT allowed (tags carry capability, e.g. Teacher
 * makes you eligible to lead a Bible Study) — only your superior can.
 */
export function canManageTags(viewer: User, target: User): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return false;
  return canEditUser(viewer, target);
}

/**
 * canChangeUsername — admin-rename of someone else's username.
 * Self-rename is handled by canChangeOwnUsername (always true with confirm).
 */
export function canChangeUsername(viewer: User, target: User): boolean {
  if (!viewer || !target) return false;
  if (viewer.id === target.id) return canChangeOwnUsername(viewer);
  // Renaming someone else's username breaks their saved-login UX, so this is
  // restricted to Overseer and above per matrix.
  if (getRoleLevel(viewer.role) < getRoleLevel(UserRole.OVERSEER)) return false;
  return canEditUser(viewer, target);
}

/**
 * canChangeOwnUsername — see PERMISSIONS.md → Universal rule #6.
 * Industry-standard behavior: any role can rename themselves with a typed
 * confirmation dialog. The audit log records the change.
 */
export function canChangeOwnUsername(_viewer: User): boolean {
  return true;
}

// =============================================================================
// Org tree nodes (Branch / Group / Team)
// =============================================================================

/**
 * GroupNodeKind narrows what kind of org-tree node we're discussing.
 * The data layer doesn't carry an explicit "kind" field on User — we infer it
 * from the user's role: BRANCH_LEADER → branch, GROUP_LEADER → group, etc.
 */
export type GroupNodeKind = 'branch' | 'group' | 'team';

/**
 * canViewGroup — see PERMISSIONS.md → Groups → "View tree"
 *
 * Per matrix: Member sees own subtree; leaders see the whole tree.
 * In practice the subtree filter is applied at render time when iterating
 * the tree, so this helper just gates the page-level access.
 */
export function canViewGroup(viewer: User): boolean {
  if (!viewer) return false;
  return true;  // every authenticated user sees the org tree page
}

/**
 * canCreateGroupNode — kind-specific creation rules:
 *   - branch: Overseer+
 *   - group:  Branch Leader+ (any branch)
 *   - team:   Group Leader+ (any branch)
 */
export function canCreateGroupNode(viewer: User, kind: GroupNodeKind): boolean {
  if (!viewer) return false;
  switch (kind) {
    case 'branch': return getRoleLevel(viewer.role) >= getRoleLevel(UserRole.OVERSEER);
    case 'group':  return getRoleLevel(viewer.role) >= getRoleLevel(UserRole.BRANCH_LEADER);
    case 'team':   return getRoleLevel(viewer.role) >= getRoleLevel(UserRole.GROUP_LEADER);
  }
}

/** Rename = same rule as edit-the-leader-of-the-node. */
export function canRenameGroup(viewer: User, nodeRole: UserRole): boolean {
  if (!viewer) return false;
  return getRoleLevel(viewer.role) >= getRoleLevel(nodeRole);
}

/**
 * canDeactivateGroup — Branch Leader+ may deactivate Group/Team nodes inside
 * any branch (cross-branch caretaking). Branch nodes themselves require
 * Overseer+.
 */
export function canDeactivateGroup(viewer: User, kind: GroupNodeKind): boolean {
  if (!viewer) return false;
  if (kind === 'branch') return getRoleLevel(viewer.role) >= getRoleLevel(UserRole.OVERSEER);
  return isAdminTier(viewer);
}

// =============================================================================
// Areas / Rooms (each Area = a branch's physical location)
// =============================================================================

/** Anyone authenticated can see the room list (used by the booking picker). */
export function canViewArea(): boolean {
  return true;
}

/** Manage = edit / deactivate / restore. Branch Leader+ across all branches. */
export function canManageArea(viewer: User): boolean {
  return isAdminTier(viewer);
}

/** Creating a brand-new Area = adding a new physical church location. Overseer+. */
export function canCreateArea(viewer: User): boolean {
  if (!viewer) return false;
  return getRoleLevel(viewer.role) >= getRoleLevel(UserRole.OVERSEER);
}

/** Branch Leader+ can add a room to any area. */
export function canCreateRoom(viewer: User): boolean {
  return isAdminTier(viewer);
}

/** Same scope as create — Branch Leader+. */
export function canManageRoom(viewer: User): boolean {
  return isAdminTier(viewer);
}

// =============================================================================
// Blocked time slots (service times no role can override)
// =============================================================================

/**
 * canManageBlockedSlot — create / edit / delete a blocked slot.
 *
 * Per matrix → "Blocked time slots" row: Branch Leader+ may manage ANY slot
 * (global or area-scoped) thanks to the cross-branch rule.
 *
 * `slot` parameter is unused for Phase 1 since the rule is uniform; reserved
 * for future per-area slot scoping if we ever lock that down.
 */
export function canManageBlockedSlot(viewer: User, _slot?: BlockedSlot): boolean {
  return isAdminTier(viewer);
}

// =============================================================================
// Contacts
// =============================================================================

/**
 * canViewContact — visibility scope.
 *
 * Members + Teacher-tagged Members: see contacts where they are the
 * assignedTeacherId (their own people).
 * Team Leader: see contacts owned by anyone in their team subtree.
 * Group Leader: subtree below them.
 * Branch Leader+: see ALL contacts across all branches (read-all matrix row).
 *
 * `subtreeUserIds` is the list of user ids inside the viewer's management
 * subtree, computed by the caller (the org tree util) and passed in. Pass an
 * empty array if you don't have it — the helper then falls back to "owner
 * matches viewer" only.
 */
export function canViewContact(
  viewer: User,
  contact: Contact,
  subtreeUserIds: string[] = [],
): boolean {
  if (!viewer || !contact) return false;
  if (isAdminTier(viewer)) return true;     // Branch L+, Overseer, Dev → all
  if (contact.assignedTeacherId === viewer.id) return true;
  if (contact.createdBy === viewer.id) return true;
  // Group / Team leaders see anyone whose owner is in their subtree.
  if (contact.assignedTeacherId && subtreeUserIds.includes(contact.assignedTeacherId)) return true;
  return false;
}

/**
 * canCreateContact — anyone may create a contact owned by themselves.
 * Assigning the contact to a different owner requires that the new owner is
 * inside the viewer's subtree (or viewer is Branch L+ for cross-branch).
 */
export function canCreateContact(
  viewer: User,
  ownerUserId: string,
  subtreeUserIds: string[] = [],
): boolean {
  if (!viewer) return false;
  if (viewer.id === ownerUserId) return true;
  if (isAdminTier(viewer)) return true;
  if (!isLeader(viewer)) return false;
  return subtreeUserIds.includes(ownerUserId);
}

/** Same scope as canViewContact + edit power (Members can only edit own). */
export function canEditContact(
  viewer: User,
  contact: Contact,
  subtreeUserIds: string[] = [],
): boolean {
  if (!viewer || !contact) return false;
  if (viewer.id === contact.assignedTeacherId) return true;
  if (isAdminTier(viewer)) return true;
  if (!isLeader(viewer)) return false;
  return contact.assignedTeacherId !== undefined &&
    subtreeUserIds.includes(contact.assignedTeacherId);
}

/**
 * canReassignContact — moving a contact to a new owner. Requires both:
 * (a) edit rights on the current contact and (b) create rights on the new owner.
 */
export function canReassignContact(
  viewer: User,
  contact: Contact,
  newOwnerId: string,
  subtreeUserIds: string[] = [],
): boolean {
  return (
    canEditContact(viewer, contact, subtreeUserIds) &&
    canCreateContact(viewer, newOwnerId, subtreeUserIds)
  );
}

/**
 * canConvertContact — promoting a contact into a User account (the converted
 * user starts as a Member by default). Requires Team Leader+ + edit access to
 * the contact.
 */
export function canConvertContact(
  viewer: User,
  contact: Contact,
  subtreeUserIds: string[] = [],
): boolean {
  if (!isLeader(viewer)) return false;
  return canEditContact(viewer, contact, subtreeUserIds);
}

// =============================================================================
// Bookings
// =============================================================================

/**
 * canEditBooking — own bookings always; others' require leader scope.
 *
 * Editing includes cancel + restore + reschedule. The booking's createdBy +
 * teacherId both establish ownership.
 */
export function canEditBooking(
  viewer: User,
  booking: Booking,
  subtreeUserIds: string[] = [],
): boolean {
  if (!viewer || !booking) return false;
  if (booking.createdBy === viewer.id) return true;
  if (booking.teacherId === viewer.id) return true;
  if (isAdminTier(viewer)) return true;
  if (!isLeader(viewer)) return false;
  return (
    subtreeUserIds.includes(booking.createdBy) ||
    (booking.teacherId !== undefined && subtreeUserIds.includes(booking.teacherId))
  );
}

// =============================================================================
// Reports + audit log
// =============================================================================

/**
 * canAccessReports — see /reports page at all.
 *
 * UPDATED in Phase 1 from the prior Overseer+ to Branch Leader+ per the
 * latest matrix. Branch Leaders see branch-scoped data; Overseer/Dev see all.
 * The scope filter is applied server-side (or in the API client for mock mode).
 */
export function canAccessReports(viewerOrRole: User | UserRole): boolean {
  const role = typeof viewerOrRole === 'string' ? viewerOrRole : viewerOrRole?.role;
  if (!role) return false;
  return getRoleLevel(role) >= getRoleLevel(UserRole.BRANCH_LEADER);
}

/** Same tier as access — anyone who can see reports can export them. */
export function canExportReports(viewerOrRole: User | UserRole): boolean {
  return canAccessReports(viewerOrRole);
}

/** Backwards-compat alias used by the contacts page header. */
export function canConvertContacts(role: UserRole): boolean {
  return getRoleLevel(role) >= getRoleLevel(UserRole.TEAM_LEADER);
}

// =============================================================================
// Admin page
// =============================================================================

/** Should the /admin link appear in the sidebar? Branch Leader+ */
export function canSeeAdminPage(viewer: User | undefined | null): boolean {
  return isAdminTier(viewer);
}

export type AdminTab =
  | 'users'
  | 'groups'
  | 'rooms'
  | 'blocked'
  | 'contacts'
  | 'audit'
  | 'tags'
  | 'permissions'
  | 'system';

/**
 * canSeeAdminTab — per the matrix table at the bottom of PERMISSIONS.md.
 * Branch Leader sees the operational tabs branch-scoped; Overseer adds
 * write access to permissions; Dev gets system config too.
 */
export function canSeeAdminTab(viewer: User, tab: AdminTab): boolean {
  if (!isAdminTier(viewer)) return false;
  switch (tab) {
    case 'users':
    case 'groups':
    case 'rooms':
    case 'blocked':
    case 'contacts':
    case 'audit':
      return true;
    case 'tags':
      return true;          // view-only for Branch Leader; edit for Overseer+
    case 'permissions':
      return true;          // read-only matrix viewer for everyone admin-tier
    case 'system':
      return viewer.role === UserRole.DEV;
  }
}

/** Only Devs can change global app config (env, defaults, etc.). */
export function canEditSystemConfig(viewer: User): boolean {
  if (!viewer) return false;
  return viewer.role === UserRole.DEV;
}

// =============================================================================
// Scope summary — used by the admin Users tab to filter the listing
// =============================================================================

export type ScopeKind = 'self' | 'team' | 'group' | 'branch' | 'all';

/**
 * scopeForRole — coarse description of the *visibility* scope a viewer has,
 * used to build server queries / filter lists at render time.
 *
 * Note: visibility ≠ management. A Branch Leader sees ALL users (visibility =
 * 'all') but can only EDIT users at-or-below Group Leader (per canEditUser).
 * The two checks are kept separate to avoid surprising "I see them but can't
 * touch them" UX.
 */
export function scopeForRole(viewer: User): ScopeKind {
  if (!viewer) return 'self';
  switch (viewer.role) {
    case UserRole.MEMBER:        return 'self';
    case UserRole.TEAM_LEADER:   return 'team';
    case UserRole.GROUP_LEADER:  return 'group';
    case UserRole.BRANCH_LEADER:
    case UserRole.OVERSEER:
    case UserRole.DEV:
      return 'all';
  }
}
