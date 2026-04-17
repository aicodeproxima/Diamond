import { api } from './client';
import type { AuthResponse } from '../types';

export const authApi = {
  login(username: string, password: string) {
    return api.post<AuthResponse>('/login', { username, password });
  },
  me() {
    return api.get<AuthResponse['user']>('/me');
  },
};
