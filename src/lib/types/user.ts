export enum UserRole {
  MEMBER = 'member',
  TEACHER = 'teacher',
  TEAM_LEADER = 'team_leader',
  GROUP_LEADER = 'group_leader',
  BRANCH_LEADER = 'branch_leader',
  OVERSEER = 'overseer',
  DEV = 'dev',
}

export const ROLE_HIERARCHY: UserRole[] = [
  UserRole.MEMBER,
  UserRole.TEACHER,
  UserRole.TEAM_LEADER,
  UserRole.GROUP_LEADER,
  UserRole.BRANCH_LEADER,
  UserRole.OVERSEER,
  UserRole.DEV,
];

export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.MEMBER]: 'Member',
  [UserRole.TEACHER]: 'Teacher',
  [UserRole.TEAM_LEADER]: 'Team Leader',
  [UserRole.GROUP_LEADER]: 'Group Leader',
  [UserRole.BRANCH_LEADER]: 'Branch Leader',
  [UserRole.OVERSEER]: 'Overseer',
  [UserRole.DEV]: 'Developer',
};

export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  groupId?: string;
  parentId?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TeacherMetrics {
  userId: string;
  totalStudents: number;
  activeStudents: number;
  currentlyStudying: number;
  continuedStudying: number;
  baptizedSinceStudying: number;
  totalSessionsLed: number;
}
