import { UserRole, ROLE_HIERARCHY } from '../types';

export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY.indexOf(role);
}

export function canViewUser(viewerRole: UserRole, targetRole: UserRole): boolean {
  return getRoleLevel(viewerRole) > getRoleLevel(targetRole);
}

export function canModifyUser(viewerRole: UserRole, targetRole: UserRole): boolean {
  return getRoleLevel(viewerRole) > getRoleLevel(targetRole);
}

export function canConvertContacts(role: UserRole): boolean {
  return getRoleLevel(role) >= getRoleLevel(UserRole.TEAM_LEADER);
}

export function canExportReports(role: UserRole): boolean {
  return getRoleLevel(role) >= getRoleLevel(UserRole.BRANCH_LEADER);
}

export function canAccessReports(role: UserRole): boolean {
  return getRoleLevel(role) >= getRoleLevel(UserRole.OVERSEER);
}

/** Anyone Team Leader and above can create accounts. */
export function canCreateUsers(role: UserRole): boolean {
  return getRoleLevel(role) >= getRoleLevel(UserRole.TEAM_LEADER);
}

/** Returns the roles a creator may assign — strictly below their own level. */
export function assignableRoles(creatorRole: UserRole): UserRole[] {
  const max = getRoleLevel(creatorRole);
  return ROLE_HIERARCHY.slice(0, max);
}
