import { apiClient } from './client';
import { API_CONFIG } from '../../config/api';
import type { UserActiveMode, UserPermission } from '../../types';

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role?: 'USER' | 'ADMIN' | 'VENDOR' | 'CONTENT_CREATOR';
    roles?: string[];
    permission?: UserPermission;
    activeMode?: UserActiveMode;
    activeRole?: string;
    createdAt: string;
    checkIns?: { placeId: string }[];
  };
  accessToken: string;
  refreshToken: string;
}

export interface ActiveModeResponse {
  user: LoginResponse['user'];
  accessToken: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authApi = {
  async register(input: RegisterInput) {
    const res = await apiClient.post<LoginResponse>(
      API_CONFIG.endpoints.auth.register,
      input,
    );
    const data = res.data;
    await apiClient.setToken(data.accessToken);
    await apiClient.setRefreshToken(data.refreshToken);
    return data;
  },

  async login(input: LoginInput) {
    const res = await apiClient.post<LoginResponse>(
      API_CONFIG.endpoints.auth.login,
      input,
    );
    const data = res.data;
    if (!data?.accessToken) {
      throw new Error('Login succeeded but no access token was returned. Please try again.');
    }
    await apiClient.setToken(data.accessToken);
    if (data.refreshToken) {
      await apiClient.setRefreshToken(data.refreshToken);
    }
    return data;
  },

  async getProfile() {
    const res = await apiClient.get<LoginResponse['user']>(
      API_CONFIG.endpoints.auth.me,
    );
    return res.data;
  },

  async logout() {
    const refreshToken = await apiClient.getRefreshToken();
    try {
      if (refreshToken) {
        await apiClient.post(API_CONFIG.endpoints.auth.logout, { refreshToken });
      }
    } catch (err) {
      console.warn('[AuthApi] Server-side token revocation failed:', err);
    }
    await apiClient.setToken(null);
    await apiClient.setRefreshToken(null);
  },

  async forgotPassword(email: string) {
    const res = await apiClient.post<any>('/auth/forgot-password', { email });
    return res.data;
  },

  async resetPassword(input: ResetPasswordInput) {
    const res = await apiClient.post<any>('/auth/reset-password', input);
    return res.data;
  },

  async updateProfile(data: any) {
    const res = await apiClient.patch<any>('/auth/profile', data);
    return res.data;
  },

  async changePassword(input: { currentPassword: string; newPassword: string }) {
    const res = await apiClient.patch<any>('/auth/password', input);
    return res.data;
  },

  async getDeletionInfo() {
    const res = await apiClient.get<AccountDeletionInfo>('/auth/account/deletion-info');
    return res.data;
  },

  async deleteAccount(input: { password: string; confirmDeletion: true }) {
    const res = await apiClient.delete<any>('/auth/account', input);
    await apiClient.setToken(null);
    await apiClient.setRefreshToken(null);
    return res.data;
  },

  async setActiveMode(activeMode: UserActiveMode) {
    const attempts: Array<{ path: string; body: Record<string, string> }> = [
      { path: API_CONFIG.endpoints.auth.activeMode, body: { activeMode } },
      { path: API_CONFIG.endpoints.auth.activeRole, body: { activeRole: activeMode } },
      { path: API_CONFIG.endpoints.auth.activeRole, body: { activeMode } },
    ];

    let lastError: any;
    for (const attempt of attempts) {
      try {
        const res = await apiClient.patch<ActiveModeResponse>(attempt.path, attempt.body);
        const data = res.data;
        if (!data?.user || !data?.accessToken) {
          throw new Error('Profile switched but the server returned an incomplete session.');
        }
        await apiClient.setToken(data.accessToken);
        return data.user;
      } catch (err: any) {
        lastError = err;
        const status = err?.status;
        const msg = String(err?.message || '').toLowerCase();
        const missingRoute =
          status === 404 ||
          msg.includes('route not found') ||
          msg.includes('cannot find') ||
          msg.includes('not found');
        if (!missingRoute) throw err;
      }
    }

    // Server is source of truth — never invent a local mode-switch success.
    throw lastError || new Error('Could not switch profile.');
  },

  /** Temporary mobile compatibility alias. */
  async setActiveRole(activeRole: UserActiveMode) {
    return this.setActiveMode(activeRole);
  },
};

export interface ResetPasswordInput {
  email: string;
  token: string;
  password: string;
}

export interface AccountDeletionInfo {
  palPoints: number;
  pendingRedemptions: number;
  vendor: { id: string; status: string; businessName: string } | null;
  creator: { id: string; status: string; username: string } | null;
  canSelfDelete: boolean;
}

