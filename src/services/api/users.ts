import { apiClient } from './client';
import { API_CONFIG } from '../../config/api';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}

export const usersApi = {
  async list(page = 1, limit = 20) {
    return apiClient.get<UserResponse[]>(
      `${API_CONFIG.endpoints.users.list}?page=${page}&limit=${limit}`,
    );
  },

  async getById(id: string) {
    const res = await apiClient.get<UserResponse>(
      API_CONFIG.endpoints.users.byId(id),
    );
    return res.data!;
  },

  async updateRole(id: string, role: 'USER' | 'ADMIN') {
    const res = await apiClient.patch<UserResponse>(
      API_CONFIG.endpoints.users.role(id),
      { role },
    );
    return res.data!;
  },
};
