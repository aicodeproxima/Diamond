import { UserRole } from './user';

export interface Group {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  leaderId: string;
  leaderRole: UserRole;
  memberCount: number;
  children?: Group[];
  createdAt: string;
}

export interface OrgNode {
  id: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  groupName?: string;
  children: OrgNode[];
  metrics?: {
    totalStudents: number;
    activeStudents: number;
    currentlyStudying: number;
    continuedStudying: number;
    baptizedSinceStudying: number;
  };
}

export interface AuditLogEntry {
  id: string;
  action: 'create' | 'update' | 'delete' | 'cancel' | 'export';
  entityType: 'booking' | 'contact' | 'user' | 'group' | 'report';
  entityId: string;
  userId: string;
  userName: string;
  details: string;
  timestamp: string;
}
