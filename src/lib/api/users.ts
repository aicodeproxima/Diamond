import { api } from './client';
import type { User, UserRole } from '../types';

export interface CreateUserPayload {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: UserRole;
  parentId?: string;
  groupId?: string;
  /** ID of the user creating the account — used for audit logging. */
  createdById: string;
}

export const usersApi = {
  getAll() {
    return api.get<User[]>('/users');
  },
  create(payload: CreateUserPayload) {
    return api.post<User>('/users', payload);
  },
};
