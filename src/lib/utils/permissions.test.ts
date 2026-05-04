/**
 * Permission utility tests.
 *
 * These tests pin every cell of the matrix in docs/PERMISSIONS.md to a
 * concrete, executable assertion. If a future refactor breaks any of them,
 * either the doc is wrong (update doc) or the helper is wrong (update code).
 *
 * Run: npm test
 */

import { describe, expect, test } from 'vitest';
import {
  assignableRoles,
  canAccessReports,
  canChangeOwnUsername,
  canChangeRole,
  canChangeUsername,
  canConvertContact,
  canCreateArea,
  canCreateContact,
  canCreateGroupNode,
  canCreateRoom,
  canCreateUser,
  canDeactivateGroup,
  canDeactivateUser,
  canEditBooking,
  canEditContact,
  canEditSystemConfig,
  canEditUser,
  canExportReports,
  canManageArea,
  canManageBlockedSlot,
  canManageRoom,
  canManageTags,
  canRenameGroup,
  canReassignContact,
  canResetPassword,
  canSeeAdminPage,
  canSeeAdminTab,
  canViewArea,
  canViewContact,
  canViewGroup,
  canViewUser,
  getRoleLevel,
  isAdminTier,
  isLeader,
  scopeForRole,
} from './permissions';
import type { Booking, Contact, User } from '../types';
import { UserRole } from '../types';

// ---------------------------------------------------------------------------
// Test fixtures — one user per role, plus a few edge users
// ---------------------------------------------------------------------------

function mkUser(id: string, role: UserRole, extras: Partial<User> = {}): User {
  return {
    id,
    username: id,
    firstName: id,
    lastName: '',
    email: `${id}@diamond.test`,
    role,
    tags: [],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...extras,
  };
}

const dev1     = mkUser('dev1',     UserRole.DEV);
const dev2     = mkUser('dev2',     UserRole.DEV);
const overseer = mkUser('over',     UserRole.OVERSEER);
const branchA  = mkUser('branchA',  UserRole.BRANCH_LEADER);
const branchB  = mkUser('branchB',  UserRole.BRANCH_LEADER);
const groupA   = mkUser('groupA',   UserRole.GROUP_LEADER);
const groupB   = mkUser('groupB',   UserRole.GROUP_LEADER);
const teamA    = mkUser('teamA',    UserRole.TEAM_LEADER);
const teamB    = mkUser('teamB',    UserRole.TEAM_LEADER);
const memberA  = mkUser('memberA',  UserRole.MEMBER);
const memberB  = mkUser('memberB',  UserRole.MEMBER);

// ===========================================================================
// Hierarchy primitives
// ===========================================================================

describe('hierarchy primitives', () => {
  test('getRoleLevel ordering matches PERMISSIONS.md', () => {
    expect(getRoleLevel(UserRole.MEMBER)).toBe(0);
    expect(getRoleLevel(UserRole.TEAM_LEADER)).toBe(1);
    expect(getRoleLevel(UserRole.GROUP_LEADER)).toBe(2);
    expect(getRoleLevel(UserRole.BRANCH_LEADER)).toBe(3);
    expect(getRoleLevel(UserRole.OVERSEER)).toBe(4);
    expect(getRoleLevel(UserRole.DEV)).toBe(5);
  });

  test('isLeader = Team Leader and above', () => {
    expect(isLeader(memberA)).toBe(false);
    expect(isLeader(teamA)).toBe(true);
    expect(isLeader(groupA)).toBe(true);
    expect(isLeader(branchA)).toBe(true);
    expect(isLeader(overseer)).toBe(true);
    expect(isLeader(dev1)).toBe(true);
    expect(isLeader(null)).toBe(false);
  });

  test('isAdminTier = Branch Leader and above', () => {
    expect(isAdminTier(memberA)).toBe(false);
    expect(isAdminTier(teamA)).toBe(false);
    expect(isAdminTier(groupA)).toBe(false);
    expect(isAdminTier(branchA)).toBe(true);
    expect(isAdminTier(overseer)).toBe(true);
    expect(isAdminTier(dev1)).toBe(true);
  });

  test('assignableRoles excludes own level except for Dev', () => {
    expect(assignableRoles(UserRole.MEMBER)).toEqual([]);
    expect(assignableRoles(UserRole.TEAM_LEADER)).toEqual([UserRole.MEMBER]);
    expect(assignableRoles(UserRole.GROUP_LEADER)).toEqual([
      UserRole.MEMBER,
      UserRole.TEAM_LEADER,
    ]);
    expect(assignableRoles(UserRole.BRANCH_LEADER)).toEqual([
      UserRole.MEMBER,
      UserRole.TEAM_LEADER,
      UserRole.GROUP_LEADER,
    ]);
    expect(assignableRoles(UserRole.OVERSEER)).toEqual([
      UserRole.MEMBER,
      UserRole.TEAM_LEADER,
      UserRole.GROUP_LEADER,
      UserRole.BRANCH_LEADER,
    ]);
    // Dev is the only role that can create another Dev.
    expect(assignableRoles(UserRole.DEV)).toContain(UserRole.DEV);
    expect(assignableRoles(UserRole.DEV)).toContain(UserRole.MEMBER);
  });
});

// ===========================================================================
// Users
// ===========================================================================

describe('canViewUser', () => {
  test('self is always viewable', () => {
    expect(canViewUser(memberA, memberA)).toBe(true);
  });

  test('Member cannot view other users', () => {
    expect(canViewUser(memberA, memberB)).toBe(false);
    expect(canViewUser(memberA, branchA)).toBe(false);
  });

  test('Leaders see all users (read-all matrix row)', () => {
    expect(canViewUser(teamA, memberA)).toBe(true);
    expect(canViewUser(branchA, dev1)).toBe(true);
    expect(canViewUser(branchA, branchB)).toBe(true);   // peer
    expect(canViewUser(overseer, dev1)).toBe(true);
  });
});

describe('canEditUser — peer-edit + cross-branch', () => {
  test('Member cannot edit other Members', () => {
    expect(canEditUser(memberA, memberB)).toBe(false);
  });

  test('Member can edit self (safe fields gated by caller)', () => {
    expect(canEditUser(memberA, memberA)).toBe(true);
  });

  test('Branch Leader can edit anyone at-or-below Branch Leader, in any branch', () => {
    expect(canEditUser(branchA, groupA)).toBe(true);
    expect(canEditUser(branchA, teamB)).toBe(true);
    expect(canEditUser(branchA, memberA)).toBe(true);
    expect(canEditUser(branchA, branchB)).toBe(true);  // peer-edit
  });

  test('Branch Leader CANNOT edit Overseer or Dev', () => {
    expect(canEditUser(branchA, overseer)).toBe(false);
    expect(canEditUser(branchA, dev1)).toBe(false);
  });

  test('Overseer can edit anyone except Devs', () => {
    expect(canEditUser(overseer, branchA)).toBe(true);
    expect(canEditUser(overseer, dev1)).toBe(false);
  });

  test('Dev can edit anyone including peers', () => {
    expect(canEditUser(dev1, dev2)).toBe(true);
    expect(canEditUser(dev1, overseer)).toBe(true);
    expect(canEditUser(dev1, memberA)).toBe(true);
  });
});

describe('canChangeRole — universal "cannot grant at-or-above own level" rule', () => {
  test('Branch Leader can promote a Member to Group Leader, but not Branch Leader', () => {
    expect(canChangeRole(branchA, memberA, UserRole.GROUP_LEADER)).toBe(true);
    expect(canChangeRole(branchA, memberA, UserRole.BRANCH_LEADER)).toBe(false);
    expect(canChangeRole(branchA, memberA, UserRole.OVERSEER)).toBe(false);
  });

  test('Only a Dev can grant the Dev role', () => {
    expect(canChangeRole(overseer, branchA, UserRole.DEV)).toBe(false);
    expect(canChangeRole(dev1, branchA, UserRole.DEV)).toBe(true);
  });

  test('Cannot change role of someone above your level', () => {
    expect(canChangeRole(branchA, dev1, UserRole.MEMBER)).toBe(false);
  });
});

describe('canDeactivateUser — no self-deactivation', () => {
  test('cannot deactivate self', () => {
    expect(canDeactivateUser(branchA, branchA)).toBe(false);
    expect(canDeactivateUser(dev1, dev1)).toBe(false);
  });

  test('Branch Leader can deactivate anyone at-or-below Branch Leader (cross-branch)', () => {
    expect(canDeactivateUser(branchA, branchB)).toBe(true);
    expect(canDeactivateUser(branchA, memberB)).toBe(true);
    expect(canDeactivateUser(branchA, dev1)).toBe(false);
  });

  test('Member cannot deactivate', () => {
    expect(canDeactivateUser(memberA, memberB)).toBe(false);
  });
});

describe('canResetPassword', () => {
  test('self password change always allowed', () => {
    expect(canResetPassword(memberA, memberA)).toBe(true);
  });

  test('mirrors canEditUser for others', () => {
    expect(canResetPassword(branchA, memberA)).toBe(true);
    expect(canResetPassword(branchA, dev1)).toBe(false);
    expect(canResetPassword(memberA, memberB)).toBe(false);
  });
});

describe('canCreateUser', () => {
  test('Member cannot create users', () => {
    expect(canCreateUser(memberA, UserRole.MEMBER)).toBe(false);
  });

  test('Team Leader can create Members only', () => {
    expect(canCreateUser(teamA, UserRole.MEMBER)).toBe(true);
    expect(canCreateUser(teamA, UserRole.TEAM_LEADER)).toBe(false);
  });

  test('Group Leader can create up to Team Leader', () => {
    expect(canCreateUser(groupA, UserRole.TEAM_LEADER)).toBe(true);
    expect(canCreateUser(groupA, UserRole.GROUP_LEADER)).toBe(false);
  });

  test('Overseer can create Branch Leaders but not other Overseers', () => {
    expect(canCreateUser(overseer, UserRole.BRANCH_LEADER)).toBe(true);
    expect(canCreateUser(overseer, UserRole.OVERSEER)).toBe(false);
    expect(canCreateUser(overseer, UserRole.DEV)).toBe(false);
  });

  test('Dev can create another Dev', () => {
    expect(canCreateUser(dev1, UserRole.DEV)).toBe(true);
  });
});

describe('canManageTags', () => {
  test('cannot self-manage tags (capability flags)', () => {
    expect(canManageTags(branchA, branchA)).toBe(false);
  });

  test('mirrors canEditUser for others', () => {
    expect(canManageTags(branchA, memberA)).toBe(true);
    expect(canManageTags(branchA, dev1)).toBe(false);
    expect(canManageTags(memberA, memberB)).toBe(false);
  });
});

describe('canChangeUsername', () => {
  test('self-rename always allowed (industry-standard with confirm)', () => {
    expect(canChangeUsername(memberA, memberA)).toBe(true);
    expect(canChangeOwnUsername(memberA)).toBe(true);
  });

  test('renaming someone else requires Overseer+', () => {
    expect(canChangeUsername(branchA, memberA)).toBe(false);
    expect(canChangeUsername(overseer, memberA)).toBe(true);
    expect(canChangeUsername(overseer, dev1)).toBe(false);   // can't reach above
    expect(canChangeUsername(dev1, overseer)).toBe(true);
  });
});

// ===========================================================================
// Org tree nodes
// ===========================================================================

describe('canCreateGroupNode', () => {
  test('only Overseer+ creates Branches', () => {
    expect(canCreateGroupNode(branchA, 'branch')).toBe(false);
    expect(canCreateGroupNode(overseer, 'branch')).toBe(true);
    expect(canCreateGroupNode(dev1, 'branch')).toBe(true);
  });

  test('Branch Leader+ creates Groups', () => {
    expect(canCreateGroupNode(groupA, 'group')).toBe(false);
    expect(canCreateGroupNode(branchA, 'group')).toBe(true);
  });

  test('Group Leader+ creates Teams', () => {
    expect(canCreateGroupNode(teamA, 'team')).toBe(false);
    expect(canCreateGroupNode(groupA, 'team')).toBe(true);
  });
});

describe('canRenameGroup', () => {
  test('rename requires viewer level >= node leader level', () => {
    expect(canRenameGroup(teamA, UserRole.TEAM_LEADER)).toBe(true);
    expect(canRenameGroup(teamA, UserRole.GROUP_LEADER)).toBe(false);
    expect(canRenameGroup(branchA, UserRole.GROUP_LEADER)).toBe(true);
  });
});

describe('canDeactivateGroup', () => {
  test('Branch only by Overseer+', () => {
    expect(canDeactivateGroup(branchA, 'branch')).toBe(false);
    expect(canDeactivateGroup(overseer, 'branch')).toBe(true);
  });
  test('Group/Team by Branch Leader+', () => {
    expect(canDeactivateGroup(branchA, 'group')).toBe(true);
    expect(canDeactivateGroup(branchA, 'team')).toBe(true);
    expect(canDeactivateGroup(groupA, 'team')).toBe(false);
  });
});

// ===========================================================================
// Areas / Rooms
// ===========================================================================

describe('areas + rooms', () => {
  test('canViewArea is universally true', () => {
    expect(canViewArea()).toBe(true);
  });
  test('canCreateArea is Overseer+', () => {
    expect(canCreateArea(branchA)).toBe(false);
    expect(canCreateArea(overseer)).toBe(true);
  });
  test('canManageArea / Room are Branch Leader+', () => {
    expect(canManageArea(groupA)).toBe(false);
    expect(canManageArea(branchA)).toBe(true);
    expect(canCreateRoom(branchA)).toBe(true);
    expect(canManageRoom(branchA)).toBe(true);
  });
});

// ===========================================================================
// Blocked slots
// ===========================================================================

describe('blocked slots', () => {
  test('Branch Leader+ may manage any blocked slot', () => {
    expect(canManageBlockedSlot(memberA)).toBe(false);
    expect(canManageBlockedSlot(teamA)).toBe(false);
    expect(canManageBlockedSlot(groupA)).toBe(false);
    expect(canManageBlockedSlot(branchA)).toBe(true);
    expect(canManageBlockedSlot(overseer)).toBe(true);
    expect(canManageBlockedSlot(dev1)).toBe(true);
  });
});

// ===========================================================================
// Contacts
// ===========================================================================

function mkContact(id: string, ownerId: string): Contact {
  // Using a minimal cast — the Contact type has many optional fields the
  // permission helpers don't read.
  return {
    id,
    firstName: id,
    lastName: '',
    assignedTeacherId: ownerId,
    createdBy: ownerId,
  } as unknown as Contact;
}

describe('canViewContact', () => {
  const cMemberA = mkContact('cA', memberA.id);

  test('owner sees own contact', () => {
    expect(canViewContact(memberA, cMemberA)).toBe(true);
  });

  test('non-owner Member cannot see', () => {
    expect(canViewContact(memberB, cMemberA)).toBe(false);
  });

  test('Team Leader sees contacts in their team subtree', () => {
    expect(canViewContact(teamA, cMemberA, [memberA.id])).toBe(true);
    expect(canViewContact(teamA, cMemberA, [])).toBe(false);
  });

  test('Branch Leader+ sees ALL contacts across branches', () => {
    expect(canViewContact(branchB, cMemberA)).toBe(true);
    expect(canViewContact(overseer, cMemberA)).toBe(true);
  });
});

describe('canCreateContact', () => {
  test('self-owner always allowed', () => {
    expect(canCreateContact(memberA, memberA.id)).toBe(true);
  });
  test('Member cannot create-for-others', () => {
    expect(canCreateContact(memberA, memberB.id)).toBe(false);
  });
  test('leader can create-for-subtree', () => {
    expect(canCreateContact(teamA, memberA.id, [memberA.id])).toBe(true);
    expect(canCreateContact(teamA, memberA.id, [])).toBe(false);
  });
  test('Branch Leader+ can create for anyone', () => {
    expect(canCreateContact(branchA, memberB.id)).toBe(true);
  });
});

describe('canEditContact', () => {
  const cMemberA = mkContact('cA', memberA.id);
  test('owner edits own', () => {
    expect(canEditContact(memberA, cMemberA)).toBe(true);
  });
  test('Member cannot edit others'+"' contacts", () => {
    expect(canEditContact(memberB, cMemberA)).toBe(false);
  });
  test('Branch Leader+ edits any contact', () => {
    expect(canEditContact(branchB, cMemberA)).toBe(true);
  });
});

describe('canConvertContact', () => {
  const cMemberA = mkContact('cA', memberA.id);
  test('Member cannot convert', () => {
    expect(canConvertContact(memberA, cMemberA)).toBe(false);
  });
  test('Team Leader can convert if scope matches', () => {
    expect(canConvertContact(teamA, cMemberA, [memberA.id])).toBe(true);
  });
  test('Branch Leader+ always can', () => {
    expect(canConvertContact(branchB, cMemberA)).toBe(true);
  });
});

describe('canReassignContact', () => {
  const cMemberA = mkContact('cA', memberA.id);
  test('combined edit + create rights', () => {
    expect(canReassignContact(branchB, cMemberA, memberB.id)).toBe(true);
    expect(canReassignContact(memberA, cMemberA, memberB.id)).toBe(false);
  });
});

// ===========================================================================
// Bookings
// ===========================================================================

function mkBooking(id: string, createdBy: string, teacherId?: string): Booking {
  return {
    id,
    createdBy,
    teacherId,
  } as unknown as Booking;
}

describe('canEditBooking', () => {
  test('owner edits own', () => {
    const b = mkBooking('b1', memberA.id);
    expect(canEditBooking(memberA, b)).toBe(true);
  });
  test('teacher edits when listed as teacher', () => {
    const b = mkBooking('b1', memberA.id, teamA.id);
    expect(canEditBooking(teamA, b)).toBe(true);
  });
  test('Member cannot edit others'+"'", () => {
    const b = mkBooking('b1', memberA.id);
    expect(canEditBooking(memberB, b)).toBe(false);
  });
  test('Branch Leader+ can edit any booking', () => {
    const b = mkBooking('b1', memberA.id);
    expect(canEditBooking(branchB, b)).toBe(true);
  });
  test('leader edits within subtree', () => {
    const b = mkBooking('b1', memberA.id);
    expect(canEditBooking(teamA, b, [memberA.id])).toBe(true);
    expect(canEditBooking(teamA, b, [])).toBe(false);
  });
});

// ===========================================================================
// Reports
// ===========================================================================

describe('reports', () => {
  test('Branch Leader+ can access reports (matrix updated from Overseer+)', () => {
    expect(canAccessReports(memberA)).toBe(false);
    expect(canAccessReports(teamA)).toBe(false);
    expect(canAccessReports(groupA)).toBe(false);
    expect(canAccessReports(branchA)).toBe(true);
    expect(canAccessReports(overseer)).toBe(true);
    expect(canAccessReports(dev1)).toBe(true);
  });
  test('export tier matches access tier', () => {
    expect(canExportReports(branchA)).toBe(true);
    expect(canExportReports(groupA)).toBe(false);
  });
  test('legacy role-string overload still works', () => {
    expect(canAccessReports(UserRole.BRANCH_LEADER)).toBe(true);
    expect(canAccessReports(UserRole.MEMBER)).toBe(false);
  });
});

// ===========================================================================
// Admin page
// ===========================================================================

describe('admin page', () => {
  test('canSeeAdminPage = Branch Leader+', () => {
    expect(canSeeAdminPage(memberA)).toBe(false);
    expect(canSeeAdminPage(groupA)).toBe(false);
    expect(canSeeAdminPage(branchA)).toBe(true);
  });

  test('all operational tabs visible to Branch L+', () => {
    expect(canSeeAdminTab(branchA, 'users')).toBe(true);
    expect(canSeeAdminTab(branchA, 'groups')).toBe(true);
    expect(canSeeAdminTab(branchA, 'rooms')).toBe(true);
    expect(canSeeAdminTab(branchA, 'blocked')).toBe(true);
    expect(canSeeAdminTab(branchA, 'contacts')).toBe(true);
    expect(canSeeAdminTab(branchA, 'audit')).toBe(true);
    expect(canSeeAdminTab(branchA, 'tags')).toBe(true);
    expect(canSeeAdminTab(branchA, 'permissions')).toBe(true);
  });

  test('system config tab is Dev-only', () => {
    expect(canSeeAdminTab(overseer, 'system')).toBe(false);
    expect(canSeeAdminTab(dev1, 'system')).toBe(true);
  });

  test('group leaders never see admin tabs', () => {
    expect(canSeeAdminTab(groupA, 'users')).toBe(false);
    expect(canSeeAdminTab(memberA, 'users')).toBe(false);
  });

  test('canEditSystemConfig is Dev-only', () => {
    expect(canEditSystemConfig(overseer)).toBe(false);
    expect(canEditSystemConfig(dev1)).toBe(true);
  });
});

// ===========================================================================
// Scope summary
// ===========================================================================

describe('scopeForRole', () => {
  test('matches matrix kinds', () => {
    expect(scopeForRole(memberA)).toBe('self');
    expect(scopeForRole(teamA)).toBe('team');
    expect(scopeForRole(groupA)).toBe('group');
    expect(scopeForRole(branchA)).toBe('all');     // Branch L sees all per peer+cross-branch rule
    expect(scopeForRole(overseer)).toBe('all');
    expect(scopeForRole(dev1)).toBe('all');
  });
});

// ===========================================================================
// Org tree visibility
// ===========================================================================

describe('canViewGroup', () => {
  test('every authenticated role sees the org tree page', () => {
    expect(canViewGroup(memberA)).toBe(true);
    expect(canViewGroup(branchA)).toBe(true);
  });
});
