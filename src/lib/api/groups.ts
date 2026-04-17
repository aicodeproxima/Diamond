import { api } from './client';
import type { Group, OrgNode, AuditLogEntry } from '../types';
import type { TeacherMetrics } from '../types/user';

export const groupsApi = {
  getGroups() {
    return api.get<Group[]>('/groups');
  },
  getOrgTree() {
    return api.get<OrgNode[]>('/groups/tree');
  },
  getTeacherMetrics(userId?: string) {
    const qs = userId ? `?userId=${userId}` : '';
    return api.get<TeacherMetrics[]>(`/metrics/teachers${qs}`);
  },
  getAuditLog(params?: {
    page?: number;
    limit?: number;
    action?: string;
    entityType?: string;
    userId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const clean: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') clean[k] = String(v);
      }
    }
    const qs = Object.keys(clean).length ? new URLSearchParams(clean).toString() : '';
    return api.get<{ entries: AuditLogEntry[]; total: number; page: number; limit: number }>(
      `/audit-log${qs ? `?${qs}` : ''}`,
    );
  },
};
