import { api } from './client';
import type { User } from '../types';

export const usersApi = {
  getAll() {
    return api.get<User[]>('/users');
  },
};
