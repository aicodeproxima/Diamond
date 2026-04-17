import { api } from './client';
import type { Contact } from '../types';

export const contactsApi = {
  getContacts(params?: {
    search?: string;
    type?: string;
    status?: string;
    stage?: string;
    sort?: string;
    sortDir?: string;
  }) {
    const clean: Record<string, string> = {};
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') clean[k] = v;
      }
    }
    const qs = Object.keys(clean).length ? new URLSearchParams(clean).toString() : '';
    return api.get<Contact[]>(`/contacts${qs ? `?${qs}` : ''}`);
  },
  getContact(id: string) {
    return api.get<Contact>(`/contacts/${id}`);
  },
  createContact(data: Partial<Contact>) {
    return api.post<Contact>('/contacts', data);
  },
  updateContact(id: string, data: Partial<Contact>) {
    return api.put<Contact>(`/contacts/${id}`, data);
  },
  deleteContact(id: string) {
    return api.delete<void>(`/contacts/${id}`);
  },
  convertToUser(id: string, data: { role: string; groupId: string }) {
    return api.post<void>(`/contacts/${id}/convert`, data);
  },
};
